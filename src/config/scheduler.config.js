// NOTE: belum ada job scheduler aktif (Phase 11). Jadwal berikut acuan saat
// `node-cron` dipasang di `src/jobs/`.

module.exports = {
  jobs: {
    expireOpportunities: '*/15 * * * *', // tiap 15 menit: tandai Opportunity lewat expiresAt jadi EXPIRED
    expireInvitations: '*/15 * * * *', // tiap 15 menit: auto-expire invitation PENDING yang lama
    recomputePartyStats: '0 * * * *', // tiap jam: recompute reputation/response/completion score semua party
    expireMemberships: '0 1 * * *', // tiap hari jam 1 pagi: tandai Membership ACTIVE yang lewat expiresAt jadi EXPIRED
    cleanupNotifications: '0 3 * * *', // tiap hari jam 3 pagi: hapus notifikasi terbaca > 90 hari
    fraudScan: '0 2 * * *', // tiap hari jam 2 pagi: scan ulang pola konsentrasi deal utk drift detection
  },
  timezone: 'Asia/Jakarta',
};
