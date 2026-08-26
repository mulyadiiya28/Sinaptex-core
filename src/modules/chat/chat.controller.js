const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const chatService = require('./chat.service');

const startConversation = asyncHandler(async (req, res) => {
  const { recipientProfileId, originType, opportunityId } = req.body;
  const result = await chatService.getOrStartConversation({
    myProfileId: req.profile.id,
    recipientProfileId,
    originType,
    opportunityId,
  });
  return created(res, result.conversation, result.isNew ? 'Conversation started' : 'Conversation already exists');
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

/**
 * REST endpoint utamanya untuk IMAGE/ATTACHMENT (perlu multipart upload).
 * Pesan TEXT sebaiknya lewat WebSocket (real-time) — lihat src/core/socket.js —
 * tapi endpoint ini tetap menerima TEXT juga sebagai fallback non-WS. Broadcast
 * real-time & notifikasi TIDAK ditangani di sini — chatService.sendMessage()
 * sudah emit event, listener terpisah (socket.js, notification.listener.js)
 * yang menindaklanjuti.
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { type, content } = req.body;
  let mediaUrl;
  let mediaName;

  if (req.file) {
    const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const uploaded = await uploadBuffer(req.file.buffer, { folder: 'chat-media', resourceType });
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
  await chatService.markAsRead({ conversationId: req.params.id, profileId: req.profile.id });
  return success(res, null, 'Marked as read');
});

module.exports = { startConversation, listConversations, getMessages, sendMessage, markAsRead };
