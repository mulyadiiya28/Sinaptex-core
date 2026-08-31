const path = require('path');

module.exports = {
  jobs: {
    expireOpportunities: '*/15 * * * *', // tiap 15 menit: tandai Opportunity lewat expiresAt jadi EXPIRED
    expireInvitations: '*/15 * * * *', // tiap 15 menit: auto-expire invitation PENDING yang lama
    recomputePartyStats: '0 * * * *', // tiap jam: recompute reputation/response/completion score semua party
    expireMemberships: '0 1 * * *', // tiap hari jam 1 pagi: tandai Membership ACTIVE yang lewat expiresAt jadi EXPIRED
    cleanupNotifications: '0 3 * * *', // tiap hari jam 3 pagi: hapus notifikasi terbaca > 90 hari
    fraudScan: '0 2 * * *', // tiap hari jam 2 pagi: scan ulang pola konsentrasi deal utk drift detection
    cleanupInactiveOpportunities: '0 4 * * *', // tiap hari jam 4 pagi: bersihkan / arsipkan offer & need suspended > 30 hari
    weeklyDatabaseBackup: '0 2 * * 0', // tiap Minggu jam 2 pagi: backup database mingguan untuk disaster recovery
  },
  inactiveOpportunityCleanup: {
    inactiveDays: parseInt(process.env.INACTIVE_OPPORTUNITY_DAYS || '30', 10),
    action: process.env.INACTIVE_OPPORTUNITY_ACTION || 'ARCHIVE_AND_DELETE', // 'ARCHIVE_AND_DELETE' | 'DELETE_ONLY' | 'ARCHIVE_ONLY'
    archiveDir:
      process.env.OPPORTUNITY_ARCHIVE_DIR ||
      path.join(process.cwd(), 'backups', 'archived_opportunities'),
  },
  disasterRecovery: {
    storageDir:
      process.env.DISASTER_RECOVERY_DIR ||
      process.env.BACKUP_DIR ||
      path.join(process.cwd(), 'backups', 'disaster_recovery'),
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '60', 10),
  },
  timezone: 'Asia/Jakarta',
};
