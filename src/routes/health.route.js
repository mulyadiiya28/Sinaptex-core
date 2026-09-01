const prisma = require('../config/prisma');
const cache = require('../core/cache');

/**
 * GET /api/v1/health
 * - database error → 503 (critical)
 * - redis/cache miss/unavailable → tetap 200 (optional dependency) + checks.redis
 */
module.exports = async function healthCheck(req, res) {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    cache: 'unknown',
  };
  let healthy = true;
  let errorCode = null;
  let errorName = null;
  let errorMessage = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    healthy = false;
    errorName = err.name || null;
    errorCode = err.code || null;
    errorMessage = typeof err.message === 'string' ? err.message.slice(0, 200) : null;
  }

  // Redis / application cache — non-critical
  const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
  const hasRedisUrl = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim());

  if (!cacheEnabled) {
    checks.redis = 'disabled';
    checks.cache = 'disabled';
  } else if (!hasRedisUrl) {
    checks.redis = 'not_configured';
    checks.cache = 'skip';
  } else {
    try {
      const client = cache.getClient && cache.getClient();
      if (!client) {
        checks.redis = 'unavailable';
        checks.cache = 'skip';
      } else {
        if (client.status === 'wait') {
          await client.connect();
        }
        const pong = await client.ping();
        if (pong === 'PONG' || pong === 'pong') {
          checks.redis = 'ok';
          // smoke: set/get ephemeral key
          const probeKey = 'sinaptex:health:probe';
          await cache.set(probeKey, { t: Date.now() }, 15);
          const probe = await cache.get(probeKey);
          checks.cache = probe ? 'ok' : 'degraded';
        } else {
          checks.redis = 'error';
          checks.cache = 'skip';
        }
      }
    } catch (err) {
      checks.redis = 'error';
      checks.cache = 'skip';
      if (process.env.NODE_ENV !== 'production') {
        errorMessage = errorMessage || (err.message && err.message.slice(0, 200));
      }
    }
  }

  const body = {
    success: healthy,
    message: healthy ? 'Sinaptex API is up' : 'Degraded',
    checks,
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    if (errorCode) body.errorCode = errorCode;
    if (errorName) body.errorName = errorName;
    if (process.env.NODE_ENV !== 'production' && errorMessage) {
      body.errorMessage = errorMessage;
    }
  }

  res.status(healthy ? 200 : 503).json(body);
};
