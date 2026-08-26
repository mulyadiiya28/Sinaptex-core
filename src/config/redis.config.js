// NOTE: Redis belum diaktifkan di app.js. Config ini disiapkan untuk Phase 05/11
// (cache layer & BullMQ queue). Install `ioredis` sudah ada di package.json.

module.exports = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // ioredis options umum; sesuaikan bila pakai Redis managed (TLS, dst)
  options: {
    maxRetriesPerRequest: null, // required by BullMQ
  },
};
