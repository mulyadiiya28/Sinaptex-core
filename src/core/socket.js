const { Server } = require('socket.io');
const { supabaseAdmin } = require('../config/supabase');
const prisma = require('../config/prisma');
const { isOriginAllowed } = require('../config/cors.config');
const logger = require('./logger');
const { eventBus, EVENTS } = require('./eventBus');
const chatService = require('../modules/chat/chat.service');

/**
 * CHAT + NOTIFICATION WebSocket layer
 * ------------------------------------------------------------------
 * Broadcast pesan baru & read-receipt TIDAK dipanggil langsung dari
 * controller/handler — socket.js cukup BERLANGGANAN event dari eventBus.
 *
 * Event WebSocket (client <-> server):
 *   Client -> Server: 'message:send' { conversationId, content }
 *   Client -> Server: 'typing:start' / 'typing:stop' { conversationId }
 *   Client -> Server: 'conversation:read' { conversationId }
 *   Server -> Client: 'message:new' <Message>
 *   Server -> Client: 'typing:start' / 'typing:stop' { conversationId, fromProfileId }
 *   Server -> Client: 'conversation:read' { conversationId, readBy }
 *   Server -> Client: 'notification:new' <Notification>
 *   Server -> Client: 'error' { message }
 */

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) return next(new Error('Invalid or expired token'));

      const user = await prisma.user.findUnique({
        where: { supabaseId: data.user.id },
        include: { profile: true },
      });
      if (!user?.profile) return next(new Error('Profile not found. Complete registration first.'));

      socket.profileId = user.profile.id;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // Chat broadcast
  eventBus.on(EVENTS.CHAT_MESSAGE_SENT, ({ message, recipientId, senderId }) => {
    if (recipientId) io.to(`profile:${recipientId}`).emit('message:new', message);
    io.to(`profile:${senderId}`).emit('message:new', message);
  });

  eventBus.on(EVENTS.CHAT_CONVERSATION_READ, ({ conversationId, readBy, otherParticipantId }) => {
    if (otherParticipantId) {
      io.to(`profile:${otherParticipantId}`).emit('conversation:read', { conversationId, readBy });
    }
  });

  // In-app notification real-time push
  eventBus.on(EVENTS.NOTIFICATION_CREATED, ({ notification }) => {
    if (!notification?.profileId) return;
    io.to(`profile:${notification.profileId}`).emit('notification:new', notification);
  });

  io.on('connection', (socket) => {
    const room = `profile:${socket.profileId}`;
    socket.join(room);
    logger.info('Socket connected', { profileId: socket.profileId, socketId: socket.id });

    socket.on('message:send', async ({ conversationId, content }, ack) => {
      try {
        const result = await chatService.sendMessage({
          conversationId,
          senderId: socket.profileId,
          type: 'TEXT',
          content,
        });
        if (typeof ack === 'function') ack({ ok: true, message: result.message });
      } catch (err) {
        socket.emit('error', { message: err.message });
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('typing:start', async ({ conversationId }) => {
      try {
        const participantIds = await chatService.getConversationParticipantIds(conversationId);
        const recipientId = participantIds.find((id) => id !== socket.profileId);
        if (recipientId) {
          io.to(`profile:${recipientId}`).emit('typing:start', { conversationId, fromProfileId: socket.profileId });
        }
      } catch {
        // non-critical
      }
    });

    socket.on('typing:stop', async ({ conversationId }) => {
      try {
        const participantIds = await chatService.getConversationParticipantIds(conversationId);
        const recipientId = participantIds.find((id) => id !== socket.profileId);
        if (recipientId) {
          io.to(`profile:${recipientId}`).emit('typing:stop', { conversationId, fromProfileId: socket.profileId });
        }
      } catch {
        // non-critical
      }
    });

    socket.on('conversation:read', async ({ conversationId }) => {
      try {
        await chatService.markAsRead({ conversationId, profileId: socket.profileId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { profileId: socket.profileId, socketId: socket.id });
    });
  });

  return io;
}

module.exports = { initSocket };
