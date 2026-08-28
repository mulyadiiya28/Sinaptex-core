const prisma = require('../../config/prisma');

/**
 * Computes the raw signals the Ranking Engine needs for a given Party's owner (Profile),
 * then caches them onto the Profile row so reads stay cheap.
 */
function round(n) {
  return Math.round(n * 100) / 100;
}

async function recomputePartyStats(partyId) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;

  const [reviews, invitations, deals, recentOpportunities] = await Promise.all([
    prisma.review.findMany({ where: { reviewee: { parties: { some: { id: partyId } } } } }),
    prisma.invitation.findMany({ where: { toPartyId: partyId } }),
    prisma.deal.findMany({ where: { invitation: { toPartyId: partyId } } }),
    prisma.opportunity.count({
      where: { partyId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  // Reputation: average review rating (1-5) -> 0..100
  const reputationScore =
    reviews.length > 0
      ? round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 20)
      : 0;

  // Response: share of invitations that got a reply (accept/reject) vs left pending -> 0..100
  const responded = invitations.filter((i) => i.status !== 'PENDING').length;
  const responseScore = invitations.length > 0 ? round((responded / invitations.length) * 100) : 0;

  // Completion: share of deals completed vs cancelled/expired -> 0..100
  const finishedDeals = deals.filter((d) =>
    ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(d.status)
  );
  const completionScore =
    finishedDeals.length > 0
      ? round((deals.filter((d) => d.status === 'COMPLETED').length / finishedDeals.length) * 100)
      : 0;

  // Activity: opportunities created in last 30 days, capped at 100
  const activityScore = round(Math.min(100, recentOpportunities * 20));

  const cancelCount = deals.filter((d) => d.status === 'CANCELLED').length;
  const expiredCount =
    deals.filter((d) => d.status === 'EXPIRED').length +
    invitations.filter((i) => i.status === 'EXPIRED').length;

  await prisma.profile.update({
    where: { id: party.ownerId },
    data: { reputationScore, responseScore, completionScore, activityScore },
  });

  return {
    reputationScore,
    responseScore,
    completionScore,
    activityScore,
    cancelCount,
    expiredCount,
  };
}

module.exports = { recomputePartyStats };
