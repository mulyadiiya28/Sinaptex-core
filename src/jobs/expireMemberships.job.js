const prisma = require('../config/prisma');
const logger = require('../core/logger');

/** Menandai Membership ACTIVE yang expiresAt-nya sudah lewat jadi EXPIRED. */
async function expireMemberships() {
  const result = await prisma.membership.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    logger.info(`Expired ${result.count} membership(s)`);
  }
  return result.count;
}

module.exports = expireMemberships;
