const prisma = require('../config/prisma');
const logger = require('../core/logger');
const { OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE } = require('../shared/constants');

/**
 * 1) Membership ACTIVE yang expiresAt sudah lewat → EXPIRED
 * 2) FR-15: Offer ACTIVE milik profile itu di-trim — keep N terbaru (default 1),
 *    sisanya CLOSED. Need tidak disentuh.
 */
async function expireMemberships() {
  const now = new Date();
  const toExpire = await prisma.membership.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    select: { id: true, profileId: true },
  });

  if (toExpire.length === 0) return 0;

  await prisma.membership.updateMany({
    where: { id: { in: toExpire.map((m) => m.id) } },
    data: { status: 'EXPIRED' },
  });
  logger.info(`Expired ${toExpire.length} membership(s)`);

  const keep = Math.max(0, OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE);

  const closeCounts = await Promise.all(
    toExpire.map(async (membership) => {
      const offers = await prisma.opportunity.findMany({
        where: {
          type: 'OFFER',
          status: 'ACTIVE',
          party: { ownerId: membership.profileId },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (offers.length <= keep) return 0;

      const toCloseIds = offers.slice(keep).map((o) => o.id);
      const result = await prisma.opportunity.updateMany({
        where: { id: { in: toCloseIds } },
        data: { status: 'CLOSED' },
      });
      return result.count;
    })
  );

  const closedOffers = closeCounts.reduce((sum, n) => sum + n, 0);

  if (closedOffers > 0) {
    logger.info(
      `Closed ${closedOffers} Offer(s) after membership expire (kept ${keep} per profile)`
    );
  }

  return toExpire.length;
}

module.exports = expireMemberships;
