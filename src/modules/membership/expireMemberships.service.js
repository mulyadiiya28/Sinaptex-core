const prisma = require('../../config/prisma');
const logger = require('../../core/logger');
const opportunityPolicyService = require('../opportunity/opportunityPolicy.service');
const { sendEmail } = require('../../utils/mailer');

async function expireMembershipsAndTransitionTier(options = {}) {
  const asOfDate = options.asOfDate || new Date();

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

  if (expiredMemberships.length === 0) {
    return {
      expiredMembershipsCount: 0,
      totalClosedOffers: 0,
      totalClosedNeeds: 0,
      transitionedProfiles: [],
    };
  }

  const membershipIds = expiredMemberships.map((m) => m.id);
  await prisma.membership.updateMany({
    where: { id: { in: membershipIds } },
    data: { status: 'EXPIRED' },
  });

  const policy = await opportunityPolicyService.getPolicy();
  const keepCount =
    typeof options.customKeepCount === 'number'
      ? options.customKeepCount
      : policy.expiredMembershipKeepCount || 1;

  const transitionedProfiles = await Promise.all(
    expiredMemberships.map(async (membership) => {
      const pruneResult = await opportunityPolicyService.pruneOpportunitiesForProfile(
        membership.profileId,
        keepCount
      );

      const excessNotice =
        pruneResult.closedOffersCount > 0 || pruneResult.closedNeedsCount > 0
          ? `${pruneResult.closedOffersCount} Offer dan ${pruneResult.closedNeedsCount} Need yang melebihi batas kuota gratis telah dinonaktifkan.`
          : 'Kuota aktif Offer & Need disesuaikan ke batas reguler.';

      try {
        await prisma.notification.create({
          data: {
            profileId: membership.profileId,
            type: 'MEMBERSHIP_EXPIRED',
            title: 'Masa Aktif Membership Berakhir',
            message: `Masa aktif paket membership Anda telah berakhir. Akun Anda telah beralih ke paket Non-Member (Free). ${excessNotice}`,
            data: {
              membershipId: membership.id,
              closedOffersCount: pruneResult.closedOffersCount,
              closedNeedsCount: pruneResult.closedNeedsCount,
            },
          },
        });
      } catch (notifErr) {
        logger.warn('Failed to dispatch membership expiration notification', {
          profileId: membership.profileId,
          error: notifErr.message,
        });
      }

      const email = membership.profile?.user?.email;
      if (email) {
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

  const totalClosedOffers = transitionedProfiles.reduce((sum, r) => sum + r.closedOffersCount, 0);
  const totalClosedNeeds = transitionedProfiles.reduce((sum, r) => sum + r.closedNeedsCount, 0);

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
  expireMembershipsAndTransitionTier,
  processExpiredMemberships: expireMembershipsAndTransitionTier,
};
