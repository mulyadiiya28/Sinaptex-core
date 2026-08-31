/**
 * Default throttle dari env. Chat limits runtime membaca DB via
 * chatRateLimitPolicy.service (admin dapat override).
 */
module.exports = {
  global: {
    windowMs: Number(process.env.THROTTLE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_MAX) || 300,
  },

  strict: {
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_STRICT_MAX) || 30,
  },

  intent: {
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_INTENT_MAX) || 40,
  },

  webhook: {
    windowMs: 60 * 1000,
    max: Number(process.env.THROTTLE_WEBHOOK_MAX) || 120,
  },

  report: {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.THROTTLE_REPORT_MAX) || 10,
    maxPendingSameTargetPerDay: 1,
  },

  /**
   * Default saja (dokumentasi / fallback). Sumber kebenaran runtime:
   * chatRateLimitPolicy.getPolicy() → DB atau env CHAT_*.
   */
  chat: {
    newConversation: {
      windowMs: 24 * 60 * 60 * 1000,
      maxFree: Number(process.env.CHAT_NEW_CONV_MAX_FREE) || 5,
      maxMember: Number(process.env.CHAT_NEW_CONV_MAX_MEMBER) || 30,
      redisTtlSeconds: Number(process.env.CHAT_RATE_LIMIT_REDIS_TTL_SECONDS) || 26 * 60 * 60,
    },
    unrepliedBurst: {
      windowMs: Number(process.env.CHAT_UNREPLIED_BURST_WINDOW_MS) || 60 * 60 * 1000,
      max: Number(process.env.CHAT_UNREPLIED_BURST_MAX) || 20,
    },
  },
};
