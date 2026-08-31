const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const throttleConfig = require('../config/throttle.config');
const redisConfig = require('../config/redis.config');
const logger = require('../core/logger');

let redisClient = null;
let redisStore = null;

// Initialize Redis client only when explicitly configured, not in test mode or CI without redis
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
const hasExplicitRedis = Boolean(process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379');

if (hasExplicitRedis && !isTestEnv) {
  try {
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

    redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:global:',
    });
  } catch (err) {
    logger.warn('Failed to initialize Redis rate-limit store, using in-memory fallback', { error: err.message });
  }
}

const rateLimiter = rateLimit({
  windowMs: throttleConfig.global.windowMs,
  max: throttleConfig.global.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore || undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(throttleConfig.global.windowMs / 1000),
    });
  },
});

module.exports = {
  rateLimiter,
  getRedisClient: () => redisClient,
};
