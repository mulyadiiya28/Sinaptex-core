const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const chatPolicy = require('./chat.policy');
const chatRateLimit = require('./chat.rateLimit');
const { eventBus, EVENTS } = require('../../core/eventBus');

/**
 * CHAT SERVICE (MVP Phase 8, direfaktor sesuai review domain) — fokus
 * ORKESTRASI & AKSES DATA saja. Aturan bisnis ("siapa boleh mulai chat
 * dengan siapa") hidup di chat.policy.js, BUKAN di sini. Efek samping
 * (notifikasi, broadcast real-time) TIDAK dipanggil langsung dari sini —
 * cukup emit event lewat eventBus, listener lain yang menindaklanjuti
 * (lihat src/core/socket.js dan src/modules/notification/notification.listener.js).
 *
 * Participant list TIDAK lagi kolom hardcode di Conversation — selalu lewat
 * ConversationParticipant, supaya siap dipakai group chat nanti tanpa migrasi.
 *
 * Rate limit (FR-16): conversation baru / hari + unreplied burst — chat.rateLimit.js
 */

/** Cari Conversation 1:1 yang sudah ada antara 2 Profile (kalau ada). */
async function findDirectConversation(profileIdA, profileIdB) {
  const aParticipations = await prisma.conversationParticipant.findMany({
    where: { participantId: profileIdA },
    select: { conversationId: true },
  });
  const conversationIds = aParticipations.map((p) => p.conversationId);
  if (conversationIds.length === 0) return null;

  const candidates = await prisma.conversationParticipant.findMany({
    where: { conversationId: { in: conversationIds }, participantId: profileIdB },
    select: { conversationId: true },
  });

  const directConversationIds = await Promise.all(
    candidates.map(async (candidate) => {
      const count = await prisma.conversationParticipant.count({
        where: { conversationId: candidate.conversationId },
      });
      return count === 2 ? candidate.conversationId : null;
    })
  );

  return directConversationIds.find(Boolean) || null;
}

async function getConversationParticipantIds(conversationId) {
  const rows = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { participantId: true },
  });
  return rows.map((r) => r.participantId);
}

async function assertParticipant(conversationId, profileId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation)
    throw ApiError.notFound('Conversation not found', ErrorCodes.CONVERSATION_NOT_FOUND);

  const participantIds = await getConversationParticipantIds(conversationId);
  chatPolicy.assertCanView(participantIds, profileId);

  return { conversation, participantIds };
}

/**
 * Ambil Conversation yang sudah ada antara 2 Profile, atau buat baru kalau
 * belum ada — gating (lewat ConversationPolicy) HANYA berlaku saat membuat baru.
 * Rate limit conversation baru juga HANYA saat isNew.
 */
async function getOrStartConversation({
  myProfileId,
  recipientProfileId,
  originType = 'PROFILE',
  opportunityId,
}) {
  const existingId = await findDirectConversation(myProfileId, recipientProfileId);
  if (existingId) {
    const conversation = await prisma.conversation.findUnique({ where: { id: existingId } });
    return { conversation, isNew: false };
  }

  // Gating HANYA untuk conversation BARU — "chat yang sudah ada tetap aktif
  // meski membership berakhir" (business rule eksplisit, ditegakkan lewat
  // findDirectConversation() di atas yang skip policy sama sekali kalau sudah ada).
  await chatPolicy.assertCanStartConversation({
    initiatorProfileId: myProfileId,
    recipientProfileId,
    originType,
  });

  // FR-16: batas conversation baru per hari (Redis + Prisma fallback)
  await chatRateLimit.assertCanCreateConversation(myProfileId);

  const conversation = await prisma.conversation.create({
    data: {
      originType,
      opportunityId,
      participants: {
        create: [{ participantId: myProfileId }, { participantId: recipientProfileId }],
      },
    },
  });

  await chatRateLimit.recordNewConversation(myProfileId);

  return { conversation, isNew: true };
}

async function listMyConversations(profileId) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { participantId: profileId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { participant: { select: { id: true, fullName: true, avatarUrl: true } } },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
  });

  return participations.map((myParticipation) => {
    const c = myParticipation.conversation;
    const counterpart =
      c.participants.find((p) => p.participantId !== profileId)?.participant || null;
    const lastMessage = c.messages[0] || null;
    const myLastReadAt = myParticipation.lastReadAt;
    const unread =
      lastMessage &&
      lastMessage.senderId !== profileId &&
      (!myLastReadAt || lastMessage.createdAt > myLastReadAt);

    return {
      id: c.id,
      originType: c.originType,
      counterpart,
      opportunityId: c.opportunityId,
      lastMessage,
      lastMessageAt: c.lastMessageAt,
      hasUnread: Boolean(unread),
    };
  });
}

async function getMessages({ conversationId, profileId, page = 1, limit = 30 }) {
  await assertParticipant(conversationId, profileId);

  const [items, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return { items: items.reverse(), total, page, limit };
}

/**
 * Dipakai baik dari REST (upload gambar/attachment) maupun handler Socket.IO
 * (pesan teks). Efek samping (broadcast/notifikasi) TIDAK ditangani di sini —
 * cukup emit EVENTS.CHAT_MESSAGE_SENT, listener lain yang menindaklanjuti.
 */
async function sendMessage({
  conversationId,
  senderId,
  type = 'TEXT',
  content,
  mediaUrl,
  mediaName,
}) {
  const { participantIds } = await assertParticipant(conversationId, senderId);

  if (type === 'TEXT' && !content?.trim()) {
    throw ApiError.badRequest('Pesan teks tidak boleh kosong', null, ErrorCodes.EMPTY_MESSAGE);
  }
  if ((type === 'IMAGE' || type === 'ATTACHMENT') && !mediaUrl) {
    throw ApiError.badRequest(
      'mediaUrl wajib diisi untuk pesan IMAGE/ATTACHMENT',
      null,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // FR-16: anti spray — batasi pesan sebelum lawan membalas (REST + WebSocket)
  await chatRateLimit.assertUnrepliedBurst(conversationId, senderId);

  const message = await prisma.message.create({
    data: { conversationId, senderId, type, content, mediaUrl, mediaName },
    include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  const recipientId = participantIds.find((id) => id !== senderId);

  eventBus.emit(EVENTS.CHAT_MESSAGE_SENT, { message, conversationId, senderId, recipientId });

  return { message, recipientId };
}

async function markAsRead({ conversationId, profileId }) {
  await assertParticipant(conversationId, profileId);

  await prisma.conversationParticipant.update({
    where: { conversationId_participantId: { conversationId, participantId: profileId } },
    data: { lastReadAt: new Date() },
  });

  const participantIds = await getConversationParticipantIds(conversationId);
  const otherParticipantId = participantIds.find((id) => id !== profileId);

  eventBus.emit(EVENTS.CHAT_CONVERSATION_READ, {
    conversationId,
    readBy: profileId,
    otherParticipantId,
  });

  return { otherParticipantId };
}

module.exports = {
  findDirectConversation,
  getConversationParticipantIds,
  assertParticipant,
  getOrStartConversation,
  listMyConversations,
  getMessages,
  sendMessage,
  markAsRead,
};
