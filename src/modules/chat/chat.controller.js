const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const chatService = require('./chat.service');
const throttleConfig = require('../../config/throttle.config');

const startConversation = asyncHandler(async (req, res) => {
  const { recipientProfileId, originType, opportunityId } = req.body;
  const result = await chatService.getOrStartConversation({
    myProfileId: req.profile.id,
    recipientProfileId,
    originType,
    opportunityId,
  });
  return created(
    res,
    result.conversation,
    result.isNew ? 'Conversation started' : 'Conversation already exists'
  );
});

const listConversations = asyncHandler(async (req, res) => {
  const conversations = await chatService.listMyConversations(req.profile.id);
  return success(res, conversations);
});

const getMessages = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await chatService.getMessages({
    conversationId: req.params.id,
    profileId: req.profile.id,
    page,
    limit,
  });
  return success(res, result.items, 'OK', 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { type, content } = req.body;
  let mediaUrl;
  let mediaName;

  if (req.file) {
    const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: 'chat-media',
      resourceType,
    });
    mediaUrl = uploaded.url;
    mediaName = req.file.originalname;
  } else if (type !== 'TEXT') {
    throw ApiError.badRequest('File wajib diupload untuk pesan IMAGE/ATTACHMENT');
  }

  const result = await chatService.sendMessage({
    conversationId: req.params.id,
    senderId: req.profile.id,
    type: type || 'TEXT',
    content,
    mediaUrl,
    mediaName,
  });

  return created(res, result.message, 'Message sent');
});

const markAsRead = asyncHandler(async (req, res) => {
  await chatService.markAsRead({
    conversationId: req.params.id,
    profileId: req.profile.id,
  });
  return success(res, null, 'Marked as read');
});

/**
 * Laporkan lawan bicara dari dalam conversation (FR-16 anti-spam).
 * Hanya partisipan yang boleh; target = participant lain.
 */
const reportConversationPeer = asyncHandler(async (req, res) => {
  const conversationId = req.params.id;
  const { reason, description } = req.body;
  const reporterId = req.profile.id;

  const { participantIds } = await chatService.assertParticipant(conversationId, reporterId);
  const reportedId = participantIds.find((id) => id !== reporterId);
  if (!reportedId) {
    throw ApiError.badRequest('Lawan bicara tidak ditemukan', null, ErrorCodes.VALIDATION_ERROR);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingPending = await prisma.userReport.count({
    where: {
      reporterId,
      reportedId,
      status: 'PENDING',
      createdAt: { gte: since },
    },
  });
  const maxSame = throttleConfig.report.maxPendingSameTargetPerDay || 1;
  if (existingPending >= maxSame) {
    throw ApiError.conflict(
      'Anda sudah memiliki laporan aktif untuk pengguna ini.',
      { reportedId, conversationId },
      ErrorCodes.CONFLICT
    );
  }

  const report = await prisma.userReport.create({
    data: {
      reporterId,
      reportedId,
      reason,
      description: description
        ? `[chat:${conversationId}] ${description}`
        : `[chat:${conversationId}]`,
    },
  });

  return created(res, report, 'Laporan dari chat diterima, akan ditinjau admin');
});

module.exports = {
  startConversation,
  listConversations,
  getMessages,
  sendMessage,
  markAsRead,
  reportConversationPeer,
};
