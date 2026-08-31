const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const throttleConfig = require('../config/throttle.config');
const redisConfig = require('../config/redis.config');
const logger = require('../core/logger');

let redisClient = null;

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const hasExplicitRedis = Boolean(
  process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379'
);

function createRedisStore(prefix) {
  if (!hasExplicitRedis || isTestEnv) return undefined;
  try {
    if (!redisClient) {
      const Redis = require('ioredis');
      redisClient = new Redis(redisConfig.url, {
        ...redisConfig.options,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : 1000),
      });
      redisClient.on('error', (err) => {
        logger.warn('Rate-limit Redis connection warning', { error: err.message });
      });
    }
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
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
    // Prefer user id when authenticated, else IP
    keyGenerator: (req) => {
      const uid = req.profile?.id || req.user?.id || req.supabaseUser?.id;
      return uid ? `u:${uid}` : `ip:${req.ip}`;
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
