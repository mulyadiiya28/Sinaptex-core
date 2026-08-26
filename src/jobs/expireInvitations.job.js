const prisma = require('../config/prisma');
const logger = require('../core/logger');
const { INVITATION_EXPIRY_DAYS } = require('../shared/constants');

/** Marks PENDING Invitations older than INVITATION_EXPIRY_DAYS as EXPIRED. */
async function expireInvitations() {
  const cutoff = new Date(Date.now() - INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.invitation.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });
  if (result.count > 0) {
    logger.info(`Expired ${result.count} invitation(s) older than ${INVITATION_EXPIRY_DAYS} days`);
  }
  return result.count;
}

module.exports = expireInvitations;
