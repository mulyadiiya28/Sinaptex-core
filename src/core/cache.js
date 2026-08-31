const Redis = require('ioredis');
const redisConfig = require('../config/redis.config');
const cacheConfig = require('../config/cache.config');
const logger = require('./logger');

let client = null;
let connectionFailed = false;
let initAttempted = false;

function shouldUseRedis() {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  if (isTest) return false;
  if (process.env.CACHE_ENABLED === 'false') return false;
  // Tanpa REDIS_URL eksplisit di production-ish: tetap coba default localhost
  // (Docker compose), tapi gagal → degrade graceful.
  return true;
}

function getClient() {
  if (!shouldUseRedis() || connectionFailed) return null;
  if (!client) {
    initAttempted = true;
    client = new Redis(redisConfig.url, {
      ...redisConfig.options,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 2 ? null : 500),
    });
    client.on('error', (err) => {
      if (!connectionFailed) {
        logger.warn('Redis cache unavailable, continuing without cache', {
          error: err.message,
        });
      }
      connectionFailed = true;
    });
    client.on('connect', () => {
      connectionFailed = false;
      logger.info('Redis cache connected');
    });
  }
  return client;
}

function fullKey(key) {
  const prefix = cacheConfig.keyPrefix || '';
  return key.startsWith(prefix) ? key : `${prefix}${key}`;
}

async function ensureConnected(c) {
  if (c.status === 'wait') {
    await c.connect();
  }
}

/**
 * @returns {Promise<any|null>} parsed JSON or null (miss / error)
 */
async function get(key) {
  const c = getClient();
  if (!c) return null;
  try {
    await ensureConnected(c);
    const raw = await c.get(fullKey(key));
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {any} value — di-JSON.stringify
 * @param {number} [ttlSeconds]
 */
async function set(key, value, ttlSeconds = cacheConfig.defaultTtlSeconds) {
  const c = getClient();
  if (!c) return false;
  try {
    await ensureConnected(c);
    const ttl = Math.max(1, Number(ttlSeconds) || cacheConfig.defaultTtlSeconds);
    await c.set(fullKey(key), JSON.stringify(value), 'EX', ttl);
    return true;
  } catch {
    return false;
  }
}

async function del(key) {
  const c = getClient();
  if (!c) return false;
  try {
    await ensureConnected(c);
    await c.del(fullKey(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * Hapus banyak key exact.
 */
async function delMany(keys) {
  if (!keys?.length) return 0;
  const c = getClient();
  if (!c) return 0;
  try {
    await ensureConnected(c);
    return c.del(...keys.map(fullKey));
  } catch {
    return 0;
  }
}

/**
 * Hapus by pattern (SCAN + DEL). Hindari KEYS * di production besar.
 * Pattern tanpa prefix — prefix ditambahkan otomatis.
 * Contoh: delByPattern('matching:uuid:*')
 */
async function delByPattern(pattern) {
  const c = getClient();
  if (!c) return 0;
  try {
    await ensureConnected(c);
    const match = fullKey(pattern);
    let cursor = '0';
    let removed = 0;
    do {
      // eslint-disable-next-line no-await-in-loop
      const [next, keys] = await c.scan(cursor, 'MATCH', match, 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        // eslint-disable-next-line no-await-in-loop
        removed += await c.del(...keys);
      }
    } while (cursor !== '0');
    return removed;
  } catch (err) {
    logger.warn('cache.delByPattern failed', { pattern, error: err.message });
    return 0;
  }
}

/**
 * Cache-aside: ambil dari cache atau jalankan loader lalu simpan.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} [ttlSeconds]
 * @returns {Promise<T>}
 */
async function getOrSet(key, loader, ttlSeconds = cacheConfig.defaultTtlSeconds) {
  const cached = await get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }
  const value = await loader();
  // Jangan cache null/undefined agar tidak “mengunci” miss salah
  if (value !== null && value !== undefined) {
    await set(key, value, ttlSeconds);
  }
  return value;
}

function isAvailable() {
  return Boolean(getClient()) && !connectionFailed;
}

module.exports = {
  get,
  set,
  del,
  delMany,
  delByPattern,
  getOrSet,
  fullKey,
  isAvailable,
  /** @deprecated gunakan getClient internal; diekspos untuk health/debug */
  getClient,
  _resetForTests() {
    client = null;
    connectionFailed = false;
    initAttempted = false;
  },
};
