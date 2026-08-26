const Redis = require('ioredis');
const redisConfig = require('../config/redis.config');
const cacheConfig = require('../config/cache.config');
const logger = require('./logger');

let client = null;
let connectionFailed = false;

function getClient() {
  if (connectionFailed) return null;
  if (!client) {
    client = new Redis(redisConfig.url, {
      ...redisConfig.options,
      lazyConnect: true,
      retryStrategy: (times) => (times > 2 ? null : 500), // stop retrying after 2 attempts
    });
    client.on('error', (err) => {
      // Cache is an optimization, not a hard dependency — log once, then degrade gracefully.
      if (!connectionFailed) {
        logger.warn('Redis cache unavailable, continuing without cache', { error: err.message });
      }
      connectionFailed = true;
    });
  }
  return client;
}

async function get(key) {
  const c = getClient();
  if (!c) return null;
  try {
    if (c.status === 'wait') await c.connect();
    const raw = await c.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // cache miss on any error — never break the request
  }
}

async function set(key, value, ttlSeconds = cacheConfig.defaultTtlSeconds) {
  const c = getClient();
  if (!c) return false;
  try {
    if (c.status === 'wait') await c.connect();
    await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

async function del(key) {
  const c = getClient();
  if (!c) return false;
  try {
    if (c.status === 'wait') await c.connect();
    await c.del(key);
    return true;
  } catch {
    return false;
  }
}

module.exports = { get, set, del };
