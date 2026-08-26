const prisma = require('../config/prisma');
const logger = require('../core/logger');
const { recomputePartyStats } = require('../modules/ranking/partyStats.service');

/**
 * Recomputes reputation/response/completion/activity score for every Party.
 * On-demand recompute already happens during matching/deal-completion (see
 * partyStats.service.js), so this job is a safety net to catch drift
 * (e.g. activityScore decaying as the 30-day window rolls forward even
 * without new events).
 */
async function recomputeAllPartyStats() {
  const parties = await prisma.party.findMany({ select: { id: true } });
  let success = 0;
  let failed = 0;

  for (const { id } of parties) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await recomputePartyStats(id);
      success += 1;
    } catch (err) {
      failed += 1;
      logger.error(`Failed to recompute stats for party ${id}`, { error: err.message });
    }
  }

  logger.info(`Recomputed party stats: ${success} ok, ${failed} failed, ${parties.length} total`);
  return { success, failed, total: parties.length };
}

module.exports = recomputeAllPartyStats;
