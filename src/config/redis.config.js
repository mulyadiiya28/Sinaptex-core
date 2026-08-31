/**
 * Redis — dipakai oleh:
 * - src/core/cache.js (application cache)
 * - rate-limit store / chat rate-limit counters
 * - BullMQ workers (maxRetriesPerRequest: null required)
 */
module.exports = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  options: {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
  },
};
