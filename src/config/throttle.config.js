module.exports = {
  global: {
    windowMs: Number(process.env.THROTTLE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_MAX) || 300,
  },

  /** Endpoint sensitif umum (auth-ish / heavy) */
  strict: {
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_STRICT_MAX) || 30,
  },

  /** Publik /intent — rawan abuse tanpa auth */
  intent: {
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_INTENT_MAX) || 40,
  },

  /** Webhook payment — longgar tapi cegah flood */
  webhook: {
    windowMs: 60 * 1000,
    max: Number(process.env.THROTTLE_WEBHOOK_MAX) || 120,
  },

  /** Buat laporan user */
  report: {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.THROTTLE_REPORT_MAX) || 10,
    /** Max laporan PENDING unik per reporter→reported per 24 jam (DB) */
    maxPendingSameTargetPerDay: 1,
  },

  chat: {
    newConversation: {
      windowMs: 24 * 60 * 60 * 1000,
      maxFree: Number(process.env.CHAT_NEW_CONV_MAX_FREE) || 5,
      maxMember: Number(process.env.CHAT_NEW_CONV_MAX_MEMBER) || 30,
      redisTtlSeconds: 26 * 60 * 60,
    },
    unrepliedBurst: {
      windowMs: 60 * 60 * 1000,
      max: Number(process.env.CHAT_UNREPLIED_BURST_MAX) || 20,
    },
  },
};
