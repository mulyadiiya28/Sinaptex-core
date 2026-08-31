const path = require('path');

module.exports = {
  jobs: {
    expireOpportunities: '*/15 * * * *',
    expireInvitations: '*/15 * * * *',
    recomputePartyStats: '0 * * * *',
    expireMemberships: '0 1 * * *',
    membershipReminders: '0 9 * * *', // tiap hari jam 09:00 WIB — H-3 / H-1
    cleanupNotifications: '0 3 * * *',
    fraudScan: '0 2 * * *',
    cleanupInactiveOpportunities: '0 4 * * *',
    weeklyDatabaseBackup: '0 2 * * 0',
  },
  inactiveOpportunityCleanup: {
    inactiveDays: parseInt(process.env.INACTIVE_OPPORTUNITY_DAYS || '30', 10),
    action: process.env.INACTIVE_OPPORTUNITY_ACTION || 'ARCHIVE_AND_DELETE',
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
