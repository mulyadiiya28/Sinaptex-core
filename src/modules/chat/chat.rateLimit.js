const Redis = require('ioredis');
const prisma = require('../../config/prisma');
const redisConfig = require('../../config/redis.config');
const throttleConfig = require('../../config/throttle.config');
const membershipService = require('../membership/membership.service');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const logger = require('../../core/logger');

/**
 * Chat rate limit (FR-16) — Redis primary, Prisma fallback.
 *
 * 1) Conversation BARU / hari (Asia/Jakarta):
 *    non-member max 5, member max 30 (override via env).
 * 2) Unreplied burst: max N pesan dari satu pihak sebelum lawan membalas,
 *    di dalam window 1 jam (Prisma-only — akurat & volume rendah).
 */

let redisClient = null;
let redisUnavailable = false;

function getRedis() {
  if (redisUnavailable) return null;
  if (!redisClient) {
    const hasExplicitRedis = Boolean(
      process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379'
    );
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
    // Di test / tanpa REDIS_URL eksplisit: skip Redis, pakai Prisma fallback
    if (!hasExplicitRedis || isTest) {
      redisUnavailable = true;
      return null;
    }
    try {
      redisClient = new Redis(redisConfig.url, {
        ...redisConfig.options,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : 500),
      });
      redisClient.on('error', (err) => {
        if (!redisUnavailable) {
          logger.warn('Chat rate-limit Redis unavailable, using Prisma fallback', {
            error: err.message,
          });
        }
        redisUnavailable = true;
      });
    } catch (err) {
      logger.warn('Chat rate-limit Redis init failed, using Prisma fallback', {
        error: err.message,
      });
      redisUnavailable = true;
      return null;
    }
  }
  return redisClient;
}

/** YYYY-MM-DD di zona Asia/Jakarta (UTC+7). */
function jakartaDayKey(date = new Date()) {
  const offsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  return local.toISOString().slice(0, 10);
}

/** Awal hari Asia/Jakarta sebagai Date UTC. */
function startOfJakartaDay(date = new Date()) {
  const day = jakartaDayKey(date);
  // 00:00 WIB = 17:00 UTC hari sebelumnya
  return new Date(`${day}T00:00:00+07:00`);
}

function newConversationRedisKey(profileId, dayKey = jakartaDayKey()) {
  return `rl:chat:conv:${profileId}:${dayKey}`;
}

async function redisGetCount(key) {
  const client = getRedis();
  if (!client) return null;
  try {
    if (client.status === 'wait') await client.connect();
    const raw = await client.get(key);
    return raw === null ? 0 : Number(raw) || 0;
  } catch {
    return null;
  }
}

async function redisIncr(key, ttlSeconds) {
  const client = getRedis();
  if (!client) return null;
  try {
    if (client.status === 'wait') await client.connect();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * Hitung conversation yang melibatkan profile hari ini (Prisma fallback).
 * Catatan: ikut menghitung conversation yang dibuka orang lain ke user ini.
 * Cukup untuk anti-spam; Redis lebih akurat karena hanya INCR di jalur initiator.
 */
async function countConversationsTodayDb(profileId) {
  const since = startOfJakartaDay();
  return prisma.conversation.count({
    where: {
      createdAt: { gte: since },
      participants: { some: { participantId: profileId } },
    },
  });
}

async function getNewConversationLimit(profileId) {
  const isMember = await membershipService.hasActiveMembership(profileId);
  const { maxFree, maxMember } = throttleConfig.chat.newConversation;
  return {
    max: isMember ? maxMember : maxFree,
    isMember,
  };
}

/**
 * Cek (tanpa increment) apakah masih boleh membuat conversation baru.
 * Dipanggil SEBELUM create.
 */
async function assertCanCreateConversation(profileId) {
  const { max, isMember } = await getNewConversationLimit(profileId);
  const key = newConversationRedisKey(profileId);

  let used = await redisGetCount(key);
  if (used === null) {
    used = await countConversationsTodayDb(profileId);
  }

  if (used >= max) {
    const tier = isMember ? 'member' : 'non-member';
    throw ApiError.tooManyRequests(
      `Batas percakapan baru hari ini tercapai (${max}/hari untuk ${tier}). Coba lagi besok.`,
      { used, max, tier, retryAfterSeconds: secondsUntilJakartaMidnight() },
      ErrorCodes.RATE_LIMITED
    );
  }

  return { used, max, isMember };
}

/**
 * Increment counter setelah conversation baru berhasil dibuat.
 * Aman dipanggil walau Redis down (no-op → counter DB tetap akurat di assert berikutnya).
 */
async function recordNewConversation(profileId) {
  const { redisTtlSeconds } = throttleConfig.chat.newConversation;
  const key = newConversationRedisKey(profileId);
  const count = await redisIncr(key, redisTtlSeconds);
  if (count === null) {
    // Prisma fallback tidak perlu write — count dihitung dari createdAt
    logger.debug('Chat rate-limit: Redis incr skipped, DB fallback active', { profileId });
  }
  return count;
}

function secondsUntilJakartaMidnight() {
  const now = new Date();
  const day = jakartaDayKey(now);
  const nextMidnight = new Date(`${day}T00:00:00+07:00`);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  return Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000));
}

/**
 * Anti spray: batasi pesan pengirim sebelum lawan membalas, dalam window 1 jam.
 * Hanya memakai Prisma (akurat, tidak bergantung Redis).
 */
async function assertUnrepliedBurst(conversationId, senderId) {
  const { windowMs, max } = throttleConfig.chat.unrepliedBurst;

  const lastFromOther = await prisma.message.findFirst({
    where: { conversationId, senderId: { not: senderId } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const windowStart = new Date(Date.now() - windowMs);
  const afterOther = lastFromOther?.createdAt || new Date(0);
  // Hitung pesan pengirim SETELAH balasan terakhir lawan, dan masih dalam window 1 jam
  const lowerBound = afterOther > windowStart ? afterOther : windowStart;

  const count = await prisma.message.count({
    where: {
      conversationId,
      senderId,
      createdAt: { gt: lowerBound },
    },
  });

  if (count >= max) {
    throw ApiError.tooManyRequests(
      `Terlalu banyak pesan sebelum ada balasan (maks ${max}/jam). Tunggu lawan membalas.`,
      { used: count, max, retryAfterSeconds: Math.ceil(windowMs / 1000) },
      ErrorCodes.RATE_LIMITED
    );
  }

  return { used: count, max };
}

module.exports = {
  assertCanCreateConversation,
  recordNewConversation,
  assertUnrepliedBurst,
  // exported for unit tests
  jakartaDayKey,
  startOfJakartaDay,
  newConversationRedisKey,
};
