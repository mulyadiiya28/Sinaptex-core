const env = require('../../config/env');

/**
 * RANKING ENGINE
 * ---------------
 * Final Ranking = matchScore
 *               + reputationScore
 *               + responseScore
 *               + completionScore
 *               + activityScore
 *               + verificationScore
 *               + premiumBoost
 *               - cancelPenalty
 *               - expiredPenalty
 *
 * All inputs are normalized to 0..100 before weighting so the final score is
 * comparable (roughly 0..100+) regardless of which signals are present.
 */

const W = env.ranking; // weights, sum ~= 1.0 across match/reputation/response/completion/activity/verification/boost

function verificationStatusToScore(status) {
  return { VERIFIED: 100, PENDING: 40, REJECTED: 10, UNVERIFIED: 0 }[status] ?? 0;
}

/**
 * @param {object} input
 * @param {number} input.matchScore 0..100 (from matching engine)
 * @param {object} input.party - candidate Party (owner side) with computed stats
 * @param {number} input.party.reputationScore 0..100 (avg rating * 20)
 * @param {number} input.party.responseScore 0..100 (faster invitation response = higher)
 * @param {number} input.party.completionScore 0..100 (completed deals / total deals)
 * @param {number} input.party.activityScore 0..100 (recency/frequency of activity)
 * @param {string} input.party.verificationStatus
 * @param {number} [input.boostPriorityWeight] 0..100, from active OpportunityBoost
 * @param {number} [input.cancelCount] number of cancelled deals by this party
 * @param {number} [input.expiredCount] number of expired opportunities/invitations
 */
function computeFinalScore({
  matchScore,
  party,
  boostPriorityWeight = 0,
  cancelCount = 0,
  expiredCount = 0,
}) {
  const reputationScore = clamp(party.reputationScore ?? 0);
  const responseScore = clamp(party.responseScore ?? 0);
  const completionScore = clamp(party.completionScore ?? 0);
  const activityScore = clamp(party.activityScore ?? 0);
  const verificationScore = verificationStatusToScore(party.verificationStatus);
  const premiumBoost = clamp(boostPriorityWeight);

  const cancelPenalty = Math.min(30, cancelCount * 5);
  const expiredPenalty = Math.min(20, expiredCount * 3);

  const breakdown = {
    matchScore: round(matchScore * W.match),
    reputationScore: round(reputationScore * W.reputation),
    responseScore: round(responseScore * W.response),
    completionScore: round(completionScore * W.completion),
    activityScore: round(activityScore * W.activity),
    verificationScore: round(verificationScore * W.verification),
    premiumBoost: round(premiumBoost * W.boost),
    cancelPenalty: -round(cancelPenalty),
    expiredPenalty: -round(expiredPenalty),
  };

  const finalScore = round(Object.values(breakdown).reduce((a, b) => a + b, 0));

  return { finalScore: Math.max(0, finalScore), breakdown };
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}
function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { computeFinalScore, verificationStatusToScore };
