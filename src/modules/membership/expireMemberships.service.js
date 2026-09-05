let prisma;
try {
  prisma = require('../../config/database').prisma;
} catch {
  try {
    prisma = require('../../config/prisma').prisma || require('../../config/prisma');
  } catch {
    prisma = {};
  }
}

const logger = require('../../core/logger');
const opportunityPolicyService = require('../opportunity/opportunityPolicy.service');
const { sendEmail } = require('../../utils/mailer');
const cache = require('../../core/cache');
const cacheConfig = require('../../config/cache.config');

async function pruneOpportunitiesForProfile(profileId, limitPerType = 1) {
  if (
    opportunityPolicyService &&
    typeof opportunityPolicyService.pruneOpportunitiesForProfile === 'function'
  ) {
    return opportunityPolicyService.pruneOpportunitiesForProfile(profileId, limitPerType);
  }
  return { keptOffers: 0, closedOffersCount: 0, keptNeeds: 0, closedNeedsCount: 0 };
}

async function expireMembershipsAndTransitionTier(options = {}) {
  const asOfDate = options.asOfDate || new Date();

  if (!prisma?.membership || typeof prisma.membership.findMany !== 'function') {
    return {
      expiredMembershipsCount: 0,
      totalClosedOffers: 0,
      totalClosedNeeds: 0,
      transitionedProfiles: [],
    };
  }

  const expiredMemberships = await prisma.membership.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: asOfDate },
    },
    include: {
      profile: {
        select: {
          id: true,
          fullName: true,
          user: {
            select: { email: true },
          },
        },
      },
    },
  });

  if (!expiredMemberships || expiredMemberships.length === 0) {
    return {
      expiredMembershipsCount: 0,
      totalClosedOffers: 0,
      totalClosedNeeds: 0,
      transitionedProfiles: [],
    };
  }

  const membershipIds = expiredMemberships.map((m) => m.id);
  if (typeof prisma.membership.updateMany === 'function') {
    await prisma.membership.updateMany({
      where: { id: { in: membershipIds } },
      data: { status: 'EXPIRED' },
    });
  }

  await Promise.all(
    expiredMemberships.map(async (m) => {
      if (cache && typeof cache.del === 'function' && cacheConfig?.keys?.membershipActive) {
        try {
          await cache.del(cacheConfig.keys.membershipActive(m.profileId));
        } catch (cacheErr) {
          logger.warn('Failed to invalidate membership cache', {
            profileId: m.profileId,
            error: cacheErr.message,
          });
        }
      }
    })
  );

  let policy = {};
  if (
    opportunityPolicyService &&
    typeof opportunityPolicyService.getPolicy === 'function'
  ) {
    try {
      policy = (await opportunityPolicyService.getPolicy()) || {};
    } catch {
      policy = {};
    }
  }

  const keepCount =
    typeof options.customKeepCount === 'number'
      ? options.customKeepCount
      : policy.expiredMembershipKeepCount || 1;

  const transitionedProfiles = await Promise.all(
    expiredMemberships.map(async (membership) => {
      let pruneResult = { closedOffersCount: 0, closedNeedsCount: 0, keptOffers: 0, keptNeeds: 0 };

      if (
        opportunityPolicyService &&
        typeof opportunityPolicyService.pruneOpportunitiesForProfile === 'function'
      ) {
        try {
          pruneResult = await opportunityPolicyService.pruneOpportunitiesForProfile(
            membership.profileId,
            keepCount
          );
        } catch (pruneErr) {
          logger.warn('Failed to prune opportunities for expired membership profile', {
            profileId: membership.profileId,
            error: pruneErr.message,
          });
        }
      }

      const closedOffers = pruneResult?.closedOffersCount || 0;
      const closedNeeds = pruneResult?.closedNeedsCount || 0;

      const excessNotice =
        closedOffers > 0 || closedNeeds > 0
          ? `${closedOffers} Offer dan ${closedNeeds} Need yang melebihi batas kuota gratis telah dinonaktifkan.`
          : 'Kuota aktif Offer & Need disesuaikan ke batas reguler.';

      if (prisma.notification && typeof prisma.notification.create === 'function') {
        try {
          await prisma.notification.create({
            data: {
              profileId: membership.profileId,
              type: 'MEMBERSHIP_EXPIRED',
              title: 'Masa Aktif Membership Berakhir',
              message: `Masa aktif paket membership Anda telah berakhir. Akun Anda telah beralih ke paket Non-Member (Free). ${excessNotice}`,
              data: {
                membershipId: membership.id,
                closedOffersCount: closedOffers,
                closedNeedsCount: closedNeeds,
              },
            },
          });
        } catch (notifErr) {
          logger.warn('Failed to dispatch membership expiration notification', {
            profileId: membership.profileId,
            error: notifErr.message,
          });
        }
      }

      const email = membership.profile?.user?.email;
      if (email && typeof sendEmail === 'function') {
        try {
          await sendEmail({
            to: email,
            subject: '[Sinaptex] Membership Anda telah berakhir',
            text: `Halo ${membership.profile.fullName || 'Pengguna'},\n\nMasa aktif membership Anda telah berakhir. Akun beralih ke paket gratis.\n${excessNotice}\n\nPerpanjang kapan saja lewat menu Membership di aplikasi.\n`,
          });
        } catch (mailErr) {
          logger.warn('Failed to email membership expiration', {
            profileId: membership.profileId,
            error: mailErr.message,
          });
        }
      }

      return {
        membershipId: membership.id,
        ...pruneResult,
      };
    })
  );

  const totalClosedOffers = transitionedProfiles.reduce(
    (sum, r) => sum + (r.closedOffersCount || 0),
    0
  );
  const totalClosedNeeds = transitionedProfiles.reduce(
    (sum, r) => sum + (r.closedNeedsCount || 0),
    0
  );

  logger.info(
    `Systematically transitioned ${expiredMemberships.length} expired membership(s) to Non-Member tier. ` +
      `Suspended/Closed ${totalClosedOffers} excess Offer(s) and ${totalClosedNeeds} excess Need(s).`
  );

  return {
    expiredMembershipsCount: expiredMemberships.length,
    totalClosedOffers,
    totalClosedNeeds,
    transitionedProfiles,
  };
}

module.exports = {
  pruneOpportunitiesForProfile,
  expireMembershipsAndTransitionTier,
  processExpiredMemberships: expireMembershipsAndTransitionTier,
};