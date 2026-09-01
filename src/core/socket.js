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
 * Heartbeat (Engine.IO):
 *   Server kirim ping tiap `pingInterval` ms; jika tidak ada pong dalam
 *   `pingTimeout` ms, koneksi dianggap mati dan dibersihkan (disconnect).
 *
 * Event WebSocket (client <-> server):
 *   Client -> Server: 'message:send' { conversationId, content }
 *   Client -> Server: 'typing:start' / 'typing:stop' { conversationId }
 *   Client -> Server: 'conversation:read' { conversationId }
 *   Server -> Client: 'message:new' <Message>
 *   Server -> Client: 'typing:start' / 'typing:stop' { conversationId, fromProfileId }
 *   Server -> Client: 'conversation:read' { conversationId, readBy }
 *   Server -> Client: 'notification:new' <Notification>
 *   Server -> Client: 'error' { code?, message }
 *   Server -> Client: 'session:replaced' (koneksi digantikan karena batas per profile)
 */

/** Max koneksi Socket.IO aktif per profileId (per proses Node). Override: WS_MAX_CONNECTIONS_PER_PROFILE */
const MAX_CONNECTIONS_PER_PROFILE = Math.max(
  1,
  Number(process.env.WS_MAX_CONNECTIONS_PER_PROFILE || 5)
);

/**
 * Heartbeat — deteksi koneksi zombie / jaringan putus.
 * Override via env (nilai dalam milidetik).
 * Default: ping tiap 25s; tunggu pong max 20s (selaras default Engine.IO, eksplisit untuk ops).
 */
const PING_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.WS_PING_INTERVAL_MS || 25_000)
);
const PING_TIMEOUT_MS = Math.max(
  2_000,
  Number(process.env.WS_PING_TIMEOUT_MS || 20_000)
);

/** @type {Map<string, Set<string>>} profileId -> Set<socketId> (urutan insert = oldest first) */
const connectionsByProfile = new Map();

function trackConnection(profileId, socketId, io) {
  let set = connectionsByProfile.get(profileId);
  if (!set) {
    set = new Set();
    connectionsByProfile.set(profileId, set);
  }

  while (set.size >= MAX_CONNECTIONS_PER_PROFILE) {
    const oldestId = set.values().next().value;
    if (!oldestId) break;

    const oldest = io.sockets.sockets.get(oldestId);
    set.delete(oldestId);

    if (oldest) {
      logger.info('Evicting oldest socket (connection limit)', {
        profileId,
        evictedSocketId: oldestId,
        limit: MAX_CONNECTIONS_PER_PROFILE,
      });
      oldest.emit('session:replaced', {
        code: 'SESSION_REPLACED',
        message: 'Sesi digantikan karena batas koneksi perangkat/tab.',
      });
      oldest.emit('error', {
        code: 'SESSION_REPLACED',
        message: 'Sesi digantikan karena batas koneksi perangkat/tab.',
      });
      oldest.disconnect(true);
    }
  }

  set.add(socketId);
}

function untrackConnection(profileId, socketId) {
  const set = connectionsByProfile.get(profileId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    connectionsByProfile.delete(profileId);
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    // Heartbeat: server → ping; client harus pong sebelum timeout
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    // Batasi ukuran frame (1 MB)
    maxHttpBufferSize: 1e6,
    // Tutup koneksi upgrade yang tidak selesai
    connectTimeout: Number(process.env.WS_CONNECT_TIMEOUT_MS || 45_000),
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
      socket.data.token = token;
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
    const profileId = socket.profileId;
    const room = `profile:${profileId}`;

    trackConnection(profileId, socket.id, io);
    socket.join(room);

    logger.info('Socket connected', {
      profileId,
      socketId: socket.id,
      activeForProfile: connectionsByProfile.get(profileId)?.size ?? 0,
      limit: MAX_CONNECTIONS_PER_PROFILE,
    });

    socket.on('message:send', async ({ conversationId, content }, ack) => {
      try {
        const result = await chatService.sendMessage({
          conversationId,
          senderId: profileId,
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
        const recipientId = participantIds.find((id) => id !== profileId);
        if (recipientId) {
          io.to(`profile:${recipientId}`).emit('typing:start', {
            conversationId,
            fromProfileId: profileId,
          });
        }
      } catch {
        // non-critical
      }
    });

    socket.on('typing:stop', async ({ conversationId }) => {
      try {
        const participantIds = await chatService.getConversationParticipantIds(conversationId);
        const recipientId = participantIds.find((id) => id !== profileId);
        if (recipientId) {
          io.to(`profile:${recipientId}`).emit('typing:stop', {
            conversationId,
            fromProfileId: profileId,
          });
        }
      } catch {
        // non-critical
      }
    });

    socket.on('conversation:read', async ({ conversationId }) => {
      try {
        await chatService.markAsRead({ conversationId, profileId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      untrackConnection(profileId, socket.id);
      logger.info('Socket disconnected', {
        profileId,
        socketId: socket.id,
        reason,
        activeForProfile: connectionsByProfile.get(profileId)?.size ?? 0,
      });
    });
  });

  logger.info('Socket.IO initialized', {
    maxConnectionsPerProfile: MAX_CONNECTIONS_PER_PROFILE,
    pingIntervalMs: PING_INTERVAL_MS,
    pingTimeoutMs: PING_TIMEOUT_MS,
  });

  return io;
}

module.exports = {
  initSocket,
  /** diekspos untuk test / observability */
  _connectionsByProfile: connectionsByProfile,
  _MAX_CONNECTIONS_PER_PROFILE: MAX_CONNECTIONS_PER_PROFILE,
  _PING_INTERVAL_MS: PING_INTERVAL_MS,
  _PING_TIMEOUT_MS: PING_TIMEOUT_MS,
};
