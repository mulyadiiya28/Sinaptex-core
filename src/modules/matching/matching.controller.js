const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { computeMatchScore, passesHardFilter } = require('./matching.service');
const { computeFinalScore } = require('../ranking/ranking.service');
const { recomputePartyStats } = require('../ranking/partyStats.service');

const oppInclude = {
  capabilities: true,
  party: true,
  boost: true,
};

/**
 * STEP 5 + STEP 6: Matching Engine + Ranking Engine
 * Finds candidate opposite-type opportunities, hard-filters them, scores them,
 * ranks them with reputation/boost/penalties, and persists a Match row per pair
 * (so an Invitation can later reference it).
 */
const runMatching = asyncHandler(async (req, res) => {
  const source = await prisma.opportunity.findUnique({
    where: { id: req.params.opportunityId },
    include: oppInclude,
  });
  if (!source) throw ApiError.notFound('Opportunity not found');

  const oppositeType = source.type === 'NEED' ? 'OFFER' : 'NEED';

  const candidates = await prisma.opportunity.findMany({
    where: {
      type: oppositeType,
      status: 'ACTIVE',
      id: { not: source.id },
      partyId: { not: source.partyId }, // don't match a party with itself
      party: { ownerId: { not: source.party.ownerId } }, // FRAUD GUARD: don't match two Party records owned by the same Profile
    },
    include: oppInclude,
    take: 200, // pre-limit pool for performance; refine with DB filters as data grows
  });

  // FRAUD GUARD: also exclude parties with a cached SAME_OWNER/SHARED_LEGAL_ID/
  // SHARED_DOCUMENT relationship (covers cases ownerId alone can't catch, e.g.
  // two different Profile accounts controlled by the same person/company).
  const knownRelated = await prisma.partyRelationship.findMany({
    where: {
      OR: [{ partyAId: source.partyId }, { partyBId: source.partyId }],
      type: { in: ['SAME_OWNER', 'SHARED_LEGAL_ID', 'SHARED_DOCUMENT'] },
    },
    select: { partyAId: true, partyBId: true },
  });
  const relatedPartyIds = new Set(
    knownRelated.flatMap((r) => [r.partyAId, r.partyBId]).filter((id) => id !== source.partyId)
  );
  const filteredCandidates = candidates.filter((c) => !relatedPartyIds.has(c.partyId));

  const sourceVerified = source.party.verificationStatus === 'VERIFIED';

  const scored = await Promise.all(
    filteredCandidates
      .filter((candidate) => {
        const candidateVerified = candidate.party.verificationStatus === 'VERIFIED';
        return passesHardFilter(source, candidate, { sourceVerified, candidateVerified });
      })
      .map(async (candidate) => {
        const { score: matchScore, breakdown: matchBreakdown } = computeMatchScore(
          source,
          candidate
        );

        const stats = (await recomputePartyStats(candidate.partyId)) || {
          reputationScore: 0,
          responseScore: 0,
          completionScore: 0,
          activityScore: 0,
          cancelCount: 0,
          expiredCount: 0,
        };

        const boostPriorityWeight = candidate.boost?.priorityWeight
          ? Math.min(100, candidate.boost.priorityWeight)
          : 0;

        const { finalScore, breakdown: rankingBreakdown } = computeFinalScore({
          matchScore,
          party: { ...candidate.party, ...stats },
          boostPriorityWeight,
          cancelCount: stats.cancelCount,
          expiredCount: stats.expiredCount,
        });

        return { candidate, matchScore, matchBreakdown, finalScore, rankingBreakdown };
      })
  );

  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top = scored.slice(0, req.query.limit);

  // Persist Match rows (upsert) so they can be referenced by an Invitation later
  const persisted = await Promise.all(
    top.map(({ candidate, matchScore, matchBreakdown, finalScore }) => {
      const [needId, offerId] =
        source.type === 'NEED' ? [source.id, candidate.id] : [candidate.id, source.id];
      return prisma.match.upsert({
        where: { needId_offerId: { needId, offerId } },
        update: { matchScore, finalScore, breakdown: matchBreakdown, hardFilterPassed: true },
        create: {
          needId,
          offerId,
          matchScore,
          finalScore,
          breakdown: matchBreakdown,
          hardFilterPassed: true,
        },
      });
    })
  );

  const results = top.map((t, i) => ({
    matchId: persisted[i].id,
    opportunity: {
      id: t.candidate.id,
      title: t.candidate.title,
      type: t.candidate.type,
      location: t.candidate.location,
      party: {
        id: t.candidate.party.id,
        name: t.candidate.party.name,
        logoUrl: t.candidate.party.logoUrl,
        verificationStatus: t.candidate.party.verificationStatus,
      },
    },
    matchScore: t.matchScore,
    finalScore: t.finalScore,
    matchBreakdown: t.matchBreakdown,
    rankingBreakdown: t.rankingBreakdown,
  }));

  return success(res, results, `Found ${results.length} ranked candidates`);
});

module.exports = { runMatching };
