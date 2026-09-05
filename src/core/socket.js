const zlib = require('zlib');
const { Server } = require('socket.io');
const { supabaseAdmin } = require('../config/supabase');
const prisma = require('../config/prisma');
const { isOriginAllowed } = require('../config/cors.config');
const logger = require('./logger');
const { eventBus, EVENTS } = require('./eventBus');
const chatService = require('../modules/chat/chat.service');
const ApiError = require('../utils/apiError');

/**
 * CHAT + NOTIFICATION WebSocket layer
 * ------------------------------------------------------------------
 * Security (merged):
 *   - Session revalidation every WS_REVALIDATION_INTERVAL_MS (default 60s)
 *   - Per-event in-memory rate limits (message:send, typing:*)
 *   - Sanitized error payloads to clients (no raw internal messages)
 *
 * Compression metrics (aplikasi):
 *   Mengukur payload outbound JSON vs hasil deflate (level sama dengan config).
 *   Ini perkiraan rasio wire permessage-deflate — Engine.IO tidak mengekspos
 *   ukuran frame terkompresi secara publik. Sample rate membatasi CPU.
 */

const MAX_CONNECTIONS_PER_PROFILE = Math.max(
  1,
  Number(process.env.WS_MAX_CONNECTIONS_PER_PROFILE || 5)
);

const PING_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.WS_PING_INTERVAL_MS || 25_000)
);
const PING_TIMEOUT_MS = Math.max(
  2_000,
  Number(process.env.WS_PING_TIMEOUT_MS || 20_000)
);

const PER_MESSAGE_DEFLATE_ENABLED = process.env.WS_PER_MESSAGE_DEFLATE !== 'false';
const PER_MESSAGE_DEFLATE_THRESHOLD = Math.max(
  0,
  Number(process.env.WS_PER_MESSAGE_DEFLATE_THRESHOLD || 1024)
);

/** 0 = off, 1 = setiap pesan, 0.1 = ~10% sample. Default: 1 (semua) untuk soft-launch. */
const COMPRESSION_METRICS_SAMPLE_RATE = Math.min(
  1,
  Math.max(0, Number(process.env.WS_COMPRESSION_METRICS_SAMPLE_RATE ?? 1))
);

const ZLIB_LEVEL = 3;

/** How often to re-check Supabase token for connected sockets (ms). */
const REVALIDATION_INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.WS_REVALIDATION_INTERVAL_MS || 60_000)
);

const perMessageDeflate = PER_MESSAGE_DEFLATE_ENABLED
  ? {
    threshold: PER_MESSAGE_DEFLATE_THRESHOLD,
    zlibDeflateOptions: {
      chunkSize: 16 * 1024,
      memLevel: 7,
      level: ZLIB_LEVEL,
    },
    zlibInflateOptions: {
      chunkSize: 16 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
  }
  : false;

/** @type {Map<string, Set<string>>} */
const connectionsByProfile = new Map();

/**
 * socket.id -> { profileId, token, timer }
 * Used for periodic session revalidation.
 * @type {Map<string, { profileId: string, token: string, timer: NodeJS.Timeout }>}
 */
const activeSessions = new Map();

const stats = {
  startedAt: new Date().toISOString(),
  connectsTotal: 0,
  disconnectsTotal: 0,
  /** @type {Record<string, number>} */
  disconnectReasons: Object.create(null),
  /** @type {Record<string, number>} */
  authFailures: Object.create(null),
  /** @type {Record<string, number>} */
  rateLimited: Object.create(null),
  compression: {
    outboundMessages: 0,
    sampledMessages: 0,
    skippedBelowThreshold: 0,
    compressedMessages: 0,
    rawBytes: 0,
    wireBytes: 0,
    rawBytesCompressedOnly: 0,
    wireBytesCompressedOnly: 0,
  },
};

// ── Event rate limits (in-memory, per profileId+event) ───────────────────────
const WS_RATE_LIMITS = {
  'message:send': { max: Number(process.env.WS_RL_MESSAGE_SEND_MAX || 30), windowMs: 60_000 },
  'typing:start': { max: Number(process.env.WS_RL_TYPING_MAX || 20), windowMs: 60_000 },
  'typing:stop': { max: Number(process.env.WS_RL_TYPING_MAX || 20), windowMs: 60_000 },
  'conversation:read': { max: Number(process.env.WS_RL_READ_MAX || 60), windowMs: 60_000 },
};

class WsRateLimiter {
  constructor() {
    /** @type {Map<string, { count: number, resetAt: number }>} */
    this.buckets = new Map();
  }

  /**
   * @param {string} profileId
   * @param {string} eventName
   * @returns {boolean} true if allowed
   */
  check(profileId, eventName) {
    const limit = WS_RATE_LIMITS[eventName];
    if (!limit) return true;

    const key = `${profileId}:${eventName}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
      return true;
    }

    if (bucket.count >= limit.max) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const item of this.buckets.entries()) {
      if (now > item[1].resetAt) this.buckets.delete(item[0]);
    }
  }
}

const wsRateLimiter = new WsRateLimiter();
setInterval(() => wsRateLimiter.cleanup(), 5 * 60 * 1000).unref?.();

// ── Error sanitization ──────────────────────────────────────────────────────

/**
 * Never send raw internal error messages / stacks to the client.
 * @param {unknown} err
 * @returns {{ message: string, code?: string }}
 */
function sanitizeError(err) {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      code: err.code || err.errorCode || 'ERROR',
    };
  }
  if (err && typeof err === 'object' && err.code && err.message && err.statusCode) {
    // Duck-typed ApiError-like
    return { message: String(err.message), code: String(err.code) };
  }
  return { message: 'An error occurred', code: 'INTERNAL_ERROR' };
}

// ── Session revalidation ────────────────────────────────────────────────────

function evictSession(socket, session, { reason, code, message }) {
  logger.warn(`WS session evicted — ${reason}`, {
    socketId: socket.id,
    profileId: session.profileId,
  });
  bumpReason(stats.authFailures, reason);
  socket.data = socket.data || {};
  socket.data.evictReason = code;
  socket.emit('session:expired', { code, message });
  socket.disconnect(true);
  stopRevalidation(socket.id);
}

async function revalidateSession(socket) {
  const session = activeSessions.get(socket.id);
  if (!session) return;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(session.token);
    if (error || !data?.user) {
      evictSession(socket, session, {
        reason: 'token_revoked_or_expired',
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Please reconnect.',
      });
      return;
    }

    // Token can still be valid while an admin bans/suspends the account
    // mid-session — re-check accountStatus against the DB on every
    // revalidation pass, not just once at handshake time.
    const profile = await prisma.profile.findUnique({
      where: { id: session.profileId },
      select: { accountStatus: true },
    });

    if (!profile) {
      evictSession(socket, session, {
        reason: 'profile_not_found',
        code: 'SESSION_INVALID',
        message: 'Profile no longer exists. Please reconnect.',
      });
      return;
    }

    if (profile.accountStatus === 'BANNED' || profile.accountStatus === 'SUSPENDED') {
      evictSession(socket, session, {
        reason: 'account_suspended',
        code: profile.accountStatus === 'BANNED' ? 'ACCOUNT_BANNED' : 'ACCOUNT_SUSPENDED',
        message: 'Your account access was revoked. Please contact support.',
      });
    }
  } catch (e) {
    logger.error('WS revalidation error', {
      error: e.message,
      socketId: socket.id,
      profileId: session.profileId,
    });
    // Do not disconnect on transient errors (network blip to Supabase/DB)
  }
}

function startRevalidation(socket, profileId, token) {
  stopRevalidation(socket.id);
  const timer = setInterval(() => {
    revalidateSession(socket);
  }, REVALIDATION_INTERVAL_MS);
  // Allow process to exit even if timers remain (tests / graceful shutdown)
  if (typeof timer.unref === 'function') timer.unref();

  activeSessions.set(socket.id, { profileId, token, timer });
}

function stopRevalidation(socketId) {
  const session = activeSessions.get(socketId);
  if (session?.timer) {
    clearInterval(session.timer);
  }
  activeSessions.delete(socketId);
}

// ── Stats helpers ───────────────────────────────────────────────────────────

function bumpReason(map, reason) {
  const key = reason || 'unknown';
  map[key] = (map[key] || 0) + 1;
}

/**
 * Catat metrik kompresi untuk satu payload outbound (per emit ke room/socket).
 * @param {unknown} payload
 * @param {number} [recipientCount=1] fan-out kasar (berapa kali frame dikirim)
 */
function recordOutboundCompression(payload, recipientCount = 1) {
  const count = Math.max(1, recipientCount || 1);
  stats.compression.outboundMessages += count;

  if (COMPRESSION_METRICS_SAMPLE_RATE <= 0) return;
  if (COMPRESSION_METRICS_SAMPLE_RATE < 1 && Math.random() > COMPRESSION_METRICS_SAMPLE_RATE) {
    return;
  }

  let raw;
  try {
    raw = Buffer.from(JSON.stringify(payload ?? null), 'utf8');
  } catch {
    return;
  }

  const rawLen = raw.length;
  stats.compression.sampledMessages += count;

  const shouldCompress =
    PER_MESSAGE_DEFLATE_ENABLED && rawLen >= PER_MESSAGE_DEFLATE_THRESHOLD;

  if (!shouldCompress) {
    stats.compression.skippedBelowThreshold += count;
    stats.compression.rawBytes += rawLen * count;
    stats.compression.wireBytes += rawLen * count;
    return;
  }

  let wireLen = rawLen;
  try {
    wireLen = zlib.deflateSync(raw, { level: ZLIB_LEVEL }).length;
  } catch {
    wireLen = rawLen;
  }

  stats.compression.compressedMessages += count;
  stats.compression.rawBytes += rawLen * count;
  stats.compression.wireBytes += wireLen * count;
  stats.compression.rawBytesCompressedOnly += rawLen * count;
  stats.compression.wireBytesCompressedOnly += wireLen * count;
}

function compressionSnapshot() {
  const c = stats.compression;
  const ratioAll =
    c.rawBytes > 0 ? Number((c.wireBytes / c.rawBytes).toFixed(4)) : null;
  const ratioCompressedOnly =
    c.rawBytesCompressedOnly > 0
      ? Number((c.wireBytesCompressedOnly / c.rawBytesCompressedOnly).toFixed(4))
      : null;
  const savedBytes = Math.max(0, c.rawBytes - c.wireBytes);
  const savedPercent =
    c.rawBytes > 0 ? Number(((savedBytes / c.rawBytes) * 100).toFixed(2)) : null;

  return {
    outboundMessages: c.outboundMessages,
    sampledMessages: c.sampledMessages,
    skippedBelowThreshold: c.skippedBelowThreshold,
    compressedMessages: c.compressedMessages,
    rawBytes: c.rawBytes,
    wireBytes: c.wireBytes,
    savedBytes,
    savedPercent,
    /** wire/raw untuk semua sample (1 = tidak hemat, 0.5 = setengah ukuran) */
    ratio: ratioAll,
    /** wire/raw hanya pesan yang benar-benar di atas threshold */
    ratioCompressedOnly,
    sampleRate: COMPRESSION_METRICS_SAMPLE_RATE,
    note: 'Application-level estimate (JSON + zlib); Engine.IO framing may differ slightly.',
  };
}

function getSocketStats() {
  let activeSockets = 0;
  Array.from(connectionsByProfile.values()).forEach((set) => {
    activeSockets += set.size;
  });
  return {
    startedAt: stats.startedAt,
    activeSockets,
    activeProfiles: connectionsByProfile.size,
    connectsTotal: stats.connectsTotal,
    disconnectsTotal: stats.disconnectsTotal,
    disconnectReasons: { ...stats.disconnectReasons },
    authFailures: { ...stats.authFailures },
    rateLimited: { ...stats.rateLimited },
    compression: compressionSnapshot(),
    config: {
      maxConnectionsPerProfile: MAX_CONNECTIONS_PER_PROFILE,
      pingIntervalMs: PING_INTERVAL_MS,
      pingTimeoutMs: PING_TIMEOUT_MS,
      perMessageDeflate: PER_MESSAGE_DEFLATE_ENABLED,
      perMessageDeflateThreshold: PER_MESSAGE_DEFLATE_THRESHOLD,
      compressionMetricsSampleRate: COMPRESSION_METRICS_SAMPLE_RATE,
      revalidationIntervalMs: REVALIDATION_INTERVAL_MS,
      rateLimits: { ...WS_RATE_LIMITS },
    },
  };
}

function roomRecipientCount(io, room) {
  try {
    const set = io.sockets.adapter.rooms.get(room);
    return set ? set.size : 1;
  } catch {
    return 1;
  }
}

/** emit ke room + catat metrik kompresi */
function emitToRoom(io, room, event, payload) {
  const n = roomRecipientCount(io, room);
  recordOutboundCompression(payload, n);
  io.to(room).emit(event, payload);
}

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
      oldest.data = oldest.data || {};
      oldest.data.evictReason = 'SESSION_REPLACED';
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
      stopRevalidation(oldestId);
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

/**
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    maxHttpBufferSize: 1e6,
    connectTimeout: Number(process.env.WS_CONNECT_TIMEOUT_MS || 45_000),
    perMessageDeflate,
    httpCompression: PER_MESSAGE_DEFLATE_ENABLED,
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
      if (!token) {
        bumpReason(stats.authFailures, 'missing_token');
        return next(new Error('Missing auth token'));
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        bumpReason(stats.authFailures, 'invalid_token');
        return next(new Error('Invalid or expired token'));
      }

      // Resolve via User.supabaseId (canonical mapping in this codebase)
      const user = await prisma.user.findUnique({
        where: { supabaseId: data.user.id },
        include: { profile: true },
      });
      if (!user?.profile) {
        bumpReason(stats.authFailures, 'profile_not_found');
        return next(new Error('Profile not found. Complete registration first.'));
      }

      // Ban/suspend gate. NOTE: the Profile model field is `accountStatus`
      // (see prisma/schema.prisma), not `status` — this previously checked
      // a field that never exists on the object, so it never fired.
      if (
        user.profile.accountStatus === 'BANNED'
        || user.profile.accountStatus === 'SUSPENDED'
      ) {
        bumpReason(stats.authFailures, 'account_suspended');
        return next(new Error('Account suspended'));
      }

      socket.profileId = user.profile.id;
      socket.data = socket.data || {};
      socket.data.token = token;
      socket.data.connectedAt = Date.now();
      next();
    } catch (err) {
      bumpReason(stats.authFailures, 'exception');
      next(new Error('Authentication failed'));
    }
  });

  eventBus.on(EVENTS.CHAT_MESSAGE_SENT, ({ message, recipientId, senderId }) => {
    if (recipientId) emitToRoom(io, `profile:${recipientId}`, 'message:new', message);
    emitToRoom(io, `profile:${senderId}`, 'message:new', message);
  });

  eventBus.on(EVENTS.CHAT_CONVERSATION_READ, ({ conversationId, readBy, otherParticipantId }) => {
    if (otherParticipantId) {
      emitToRoom(io, `profile:${otherParticipantId}`, 'conversation:read', {
        conversationId,
        readBy,
      });
    }
  });

  eventBus.on(EVENTS.NOTIFICATION_CREATED, ({ notification }) => {
    if (!notification?.profileId) return;
    emitToRoom(io, `profile:${notification.profileId}`, 'notification:new', notification);
  });

  io.on('connection', (socket) => {
    const { profileId } = socket;
    const room = `profile:${profileId}`;
    const token = socket.data?.token;

    trackConnection(profileId, socket.id, io);
    socket.join(room);
    stats.connectsTotal += 1;

    if (token) {
      startRevalidation(socket, profileId, token);
    }

    logger.info('Socket connected', {
      profileId,
      socketId: socket.id,
      transport: socket.conn?.transport?.name,
      activeForProfile: connectionsByProfile.get(profileId)?.size ?? 0,
      limit: MAX_CONNECTIONS_PER_PROFILE,
    });

    socket.on('message:send', async ({ conversationId, content }, ack) => {
      try {
        if (!wsRateLimiter.check(profileId, 'message:send')) {
          bumpReason(stats.rateLimited, 'message:send');
          const payload = {
            ok: false,
            code: 'RATE_LIMITED',
            message: 'Too many messages. Please slow down.',
          };
          if (typeof ack === 'function') ack(payload);
          return;
        }

        const result = await chatService.sendMessage({
          conversationId,
          senderId: profileId,
          type: 'TEXT',
          content,
        });
        if (typeof ack === 'function') ack({ ok: true, message: result.message });
      } catch (err) {
        const safe = sanitizeError(err);
        socket.emit('error', safe);
        if (typeof ack === 'function') ack({ ok: false, ...safe });
      }
    });

    socket.on('typing:start', async ({ conversationId }) => {
      try {
        if (!wsRateLimiter.check(profileId, 'typing:start')) {
          bumpReason(stats.rateLimited, 'typing:start');
          return;
        }

        const participantIds = await chatService.getConversationParticipantIds(conversationId);
        const recipientId = participantIds.find((id) => id !== profileId);
        if (recipientId) {
          emitToRoom(io, `profile:${recipientId}`, 'typing:start', {
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
        if (!wsRateLimiter.check(profileId, 'typing:stop')) {
          bumpReason(stats.rateLimited, 'typing:stop');
          return;
        }

        const participantIds = await chatService.getConversationParticipantIds(conversationId);
        const recipientId = participantIds.find((id) => id !== profileId);
        if (recipientId) {
          emitToRoom(io, `profile:${recipientId}`, 'typing:stop', {
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
        if (!wsRateLimiter.check(profileId, 'conversation:read')) {
          bumpReason(stats.rateLimited, 'conversation:read');
          return;
        }

        await chatService.markAsRead({ conversationId, profileId });
      } catch (err) {
        const safe = sanitizeError(err);
        socket.emit('error', safe);
      }
    });

    socket.on('disconnect', (reason) => {
      untrackConnection(profileId, socket.id);
      stopRevalidation(socket.id);

      const evict = socket.data?.evictReason;
      const normalized = evict ? `${reason}:${evict}` : reason;
      stats.disconnectsTotal += 1;
      bumpReason(stats.disconnectReasons, normalized);

      const connectedAt = socket.data?.connectedAt;
      const durationMs =
        typeof connectedAt === 'number' ? Math.max(0, Date.now() - connectedAt) : null;

      logger.info('Socket disconnected', {
        profileId,
        socketId: socket.id,
        reason: normalized,
        engineReason: reason,
        transport: socket.conn?.transport?.name,
        durationMs,
        activeForProfile: connectionsByProfile.get(profileId)?.size ?? 0,
      });
    });
  });

  logger.info('Socket.IO initialized', {
    maxConnectionsPerProfile: MAX_CONNECTIONS_PER_PROFILE,
    pingIntervalMs: PING_INTERVAL_MS,
    pingTimeoutMs: PING_TIMEOUT_MS,
    perMessageDeflate: PER_MESSAGE_DEFLATE_ENABLED,
    perMessageDeflateThreshold: PER_MESSAGE_DEFLATE_THRESHOLD,
    compressionMetricsSampleRate: COMPRESSION_METRICS_SAMPLE_RATE,
    revalidationIntervalMs: REVALIDATION_INTERVAL_MS,
  });

  return io;
}

module.exports = {
  initSocket,
  getSocketStats,
  sanitizeError,
  _connectionsByProfile: connectionsByProfile,
  _MAX_CONNECTIONS_PER_PROFILE: MAX_CONNECTIONS_PER_PROFILE,
  _PING_INTERVAL_MS: PING_INTERVAL_MS,
  _PING_TIMEOUT_MS: PING_TIMEOUT_MS,
  _PER_MESSAGE_DEFLATE_ENABLED: PER_MESSAGE_DEFLATE_ENABLED,
  _REVALIDATION_INTERVAL_MS: REVALIDATION_INTERVAL_MS,
  _WS_RATE_LIMITS: WS_RATE_LIMITS,
};
