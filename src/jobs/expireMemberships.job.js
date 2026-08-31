const prisma = require('../config/prisma');
const logger = require('../core/logger');
const {
  OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE,
  NEEDS_KEPT_AFTER_MEMBERSHIP_EXPIRE,
} = require('../shared/constants');

/**
 * 1) Membership ACTIVE yang expiresAt sudah lewat → EXPIRED
 * 2) FR-15 / Policy: Saat membership EXPIRED dan tidak diperpanjang,
 *    kembalikan ke posisi default (1 Offer dan 1 Need terbaru tetap ACTIVE,
 *    sisanya diubah statusnya menjadi CLOSED agar histori transaksi/chat tetap utuh).
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

  const keepOffers = Math.max(0, OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE);
  const keepNeeds = Math.max(0, NEEDS_KEPT_AFTER_MEMBERSHIP_EXPIRE);

  const trimResults = await Promise.all(
    toExpire.map(async (membership) => {
      // 1. Trim Offers: Pertahankan 1 terbaru (berdasarkan createdAt DESC), sisanya CLOSED
      const offers = await prisma.opportunity.findMany({
        where: {
          type: 'OFFER',
          status: 'ACTIVE',
          party: { ownerId: membership.profileId },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      let closedOfferCount = 0;
      if (offers.length > keepOffers) {
        const toCloseOfferIds = offers.slice(keepOffers).map((o) => o.id);
        const result = await prisma.opportunity.updateMany({
          where: { id: { in: toCloseOfferIds } },
          data: { status: 'CLOSED' },
        });
        closedOfferCount = result.count;
      }

      // 2. Trim Needs: Pertahankan 1 terbaru (berdasarkan createdAt DESC), sisanya CLOSED
      const needs = await prisma.opportunity.findMany({
        where: {
          type: 'NEED',
          status: 'ACTIVE',
          party: { ownerId: membership.profileId },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      let closedNeedCount = 0;
      if (needs.length > keepNeeds) {
        const toCloseNeedIds = needs.slice(keepNeeds).map((n) => n.id);
        const result = await prisma.opportunity.updateMany({
          where: { id: { in: toCloseNeedIds } },
          data: { status: 'CLOSED' },
        });
        closedNeedCount = result.count;
      }

      return { closedOfferCount, closedNeedCount };
    })
  );

  const totalClosedOffers = trimResults.reduce((sum, r) => sum + r.closedOfferCount, 0);
  const totalClosedNeeds = trimResults.reduce((sum, r) => sum + r.closedNeedCount, 0);

  if (totalClosedOffers > 0 || totalClosedNeeds > 0) {
    logger.info(
      `Trimmed opportunities after membership expire: ` +
        `Closed ${totalClosedOffers} Offer(s) (kept ${keepOffers}) and ` +
        `${totalClosedNeeds} Need(s) (kept ${keepNeeds})`
    );
  }

  return toExpire.length;
}

module.exports = expireMemberships;

