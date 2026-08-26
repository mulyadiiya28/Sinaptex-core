module.exports = {
  // Skor risiko per severity, dijumlahkan lintas semua check yang terpicu.
  severityWeight: {
    LOW: 10,
    MEDIUM: 30,
    HIGH: 60,
    CRITICAL: 100,
  },

  // >= blockThreshold: transisi Deal ke COMPLETED DIBLOKIR, wajib review admin dulu.
  // >= warnThreshold (tapi < blockThreshold): Deal tetap COMPLETED, tapi FraudFlag dibuat untuk ditinjau.
  blockThreshold: 90,
  warnThreshold: 25,

  // Deal Concentration check: seberapa besar porsi deal COMPLETED sebuah Party
  // yang ternyata dengan 1 counterparty yang sama, dianggap mencurigakan.
  concentration: {
    minCompletedDealsToCheck: 3, // di bawah ini, sampel terlalu kecil untuk disimpulkan
    highRatio: 0.8, // >=80% deal hanya dengan 1 lawan -> HIGH
    mediumRatio: 0.5, // >=50% -> MEDIUM
  },

  // Completion Velocity check: deal yang pindah dari DEAL -> COMPLETED terlalu
  // cepat (dalam jam) dianggap mencurigakan (indikasi tidak ada pekerjaan nyata).
  velocity: {
    suspiciousUnderHours: 1,
  },
};
