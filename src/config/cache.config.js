// NOTE: belum ada implementasi cache aktif (Phase 05). Nilai TTL berikut jadi acuan
// saat cache layer (Redis) dipasang, misal untuk cache hasil `matching/:id/run`.

module.exports = {
  defaultTtlSeconds: 60,
  ttl: {
    matchingResult: 30, // hasil matching berubah cepat (data baru, boost baru)
    opportunityList: 60,
    boostPlans: 3600, // jarang berubah
  },
};
