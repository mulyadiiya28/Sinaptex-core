module.exports = {
  global: {
    windowMs: Number(process.env.THROTTLE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.THROTTLE_MAX) || 300,
  },
  // Batas lebih ketat untuk endpoint sensitif/berat, dipakai per-route jika dibutuhkan
  strict: {
    windowMs: 15 * 60 * 1000,
    max: 20,
  },

  /**
   * Chat anti-spam (FR-16).
   * - newConversation: batas conversation BARU per profile per hari kalender (Asia/Jakarta).
   * - unrepliedBurst: batas pesan bertubi sebelum lawan membalas (per conversation).
   */
  chat: {
    newConversation: {
      windowMs: 24 * 60 * 60 * 1000,
      maxFree: Number(process.env.CHAT_NEW_CONV_MAX_FREE) || 5,
      maxMember: Number(process.env.CHAT_NEW_CONV_MAX_MEMBER) || 30,
      /** TTL Redis sedikit lebih dari 24 jam agar counter tidak hilang di tengah hari */
      redisTtlSeconds: 26 * 60 * 60,
    },
    unrepliedBurst: {
      windowMs: 60 * 60 * 1000,
      max: Number(process.env.CHAT_UNREPLIED_BURST_MAX) || 20,
    },
  },
};
