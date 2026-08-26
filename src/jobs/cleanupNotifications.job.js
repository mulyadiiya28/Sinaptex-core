const prisma = require('../config/prisma');
const logger = require('../core/logger');
const { NOTIFICATION_RETENTION_DAYS } = require('../shared/constants');

/** Deletes read notifications older than NOTIFICATION_RETENTION_DAYS. */
async function cleanupNotifications() {
  const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.notification.deleteMany({
    where: { isRead: true, createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(`Cleaned up ${result.count} old notification(s)`);
  }
  return result.count;
}

module.exports = cleanupNotifications;
