// NOTE: belum ada worker aktif (Phase 11). Nama-nama queue disiapkan di sini supaya
// producer (controller/service) dan consumer (worker) konsisten saat diimplementasikan.

module.exports = {
  queues: {
    notification: 'queue:notification', // kirim email/WA/push di background
    partyStats: 'queue:party-stats', // recompute reputation/response/completion score
    expireCheck: 'queue:expire-check', // scan & expire Opportunity/Invitation/Deal
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
};
