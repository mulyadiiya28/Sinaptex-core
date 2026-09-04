const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const throttleConfig = require('../config/throttle.config');
const redisConfig = require('../config/redis.config');
const logger = require('../core/logger');

let redisClient = null;

// Helper to automatically prepend 'rediss://' scheme if URL starts with '//'
const sanitizeRedisUrl = (rawUrl) => {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith('//')) {
    return `rediss:${rawUrl}`;
  }
  return rawUrl;
};

const activeRedisUrl = sanitizeRedisUrl(redisConfig.url || process.env.REDIS_URL);

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const hasExplicitRedis = Boolean(
  activeRedisUrl && activeRedisUrl !== 'redis://localhost:6379'
);

// Warn once at module load if production is running without a shared Redis store.
if (process.env.NODE_ENV === 'production' && !hasExplicitRedis) {
  logger.warn(
    'Rate limiter running WITHOUT Redis store in production — limits are per-process only.'
  );
}

function getOrCreateRedisClient() {
  if (redisClient) return redisClient;

  const Redis = require('ioredis');
  
  redisClient = new Redis(activeRedisUrl, {
    ...redisConfig.options,
    enableOfflineQueue: true,
    // Fix 1: Set to null so ioredis queues commands during connection hiccups 
    // instead of throwing MaxRetriesPerRequestError
    maxRetriesPerRequest: null,
    // Fix 2: Keep TLS/TCP socket active to prevent ECONNRESET drops
    keepAlive: 10000,
    // Fix 3: Reconnect indefinitely with smooth backoff rather than aborting after 3 tries
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  redisClient.on('error', (err) => {
    logger.warn('Rate-limit Redis connection warning', { error: err.message });
  });

  return redisClient;
}

function createRedisStore(prefix) {
  if (!hasExplicitRedis || isTestEnv) return undefined;
  try {
    const client = getOrCreateRedisClient();

    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix,
    });
  } catch (err) {
    logger.warn('Failed to init Redis rate-limit store', { prefix, error: err.message });
    return undefined;
  }
}

function makeLimiter({ windowMs, max, prefix, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(prefix),
    // Using ipKeyGenerator for safe IPv6 handling
    keyGenerator: (req) => {
      const uid = req.profile?.id || req.user?.id || req.supabaseUser?.id;
      return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip)}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

const rateLimiter = makeLimiter({
  windowMs: throttleConfig.global.windowMs,
  max: throttleConfig.global.max,
  prefix: 'rl:global:',
  message: 'Too many requests, please try again later.',
});

const strictLimiter = makeLimiter({
  windowMs: throttleConfig.strict.windowMs,
  max: throttleConfig.strict.max,
  prefix: 'rl:strict:',
  message: 'Terlalu banyak permintaan ke endpoint ini. Coba lagi nanti.',
});

const intentLimiter = makeLimiter({
  windowMs: throttleConfig.intent.windowMs,
  max: throttleConfig.intent.max,
  prefix: 'rl:intent:',
  message: 'Terlalu banyak permintaan Intent. Coba lagi dalam beberapa menit.',
});

const webhookLimiter = makeLimiter({
  windowMs: throttleConfig.webhook.windowMs,
  max: throttleConfig.webhook.max,
  prefix: 'rl:webhook:',
  message: 'Webhook rate limit exceeded.',
});

const reportLimiter = makeLimiter({
  windowMs: throttleConfig.report.windowMs,
  max: throttleConfig.report.max,
  prefix: 'rl:report:',
  message: 'Terlalu banyak laporan. Coba lagi nanti.',
});

module.exports = {
  rateLimiter,
  strictLimiter,
  intentLimiter,
  webhookLimiter,
  reportLimiter,
  getRedisClient: () => redisClient,
};