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

  const results = await Promise.all(
    parties.map(async ({ id }) => {
      try {
        await recomputePartyStats(id);
        return { ok: true, id };
      } catch (err) {
        logger.error(`Failed to recompute stats for party ${id}`, { error: err.message });
        return { ok: false, id };
      }
    })
  );

  const success = results.filter((r) => r.ok).length;
  const failed = results.length - success;

  logger.info(`Recomputed party stats: ${success} ok, ${failed} failed, ${parties.length} total`);
  return { success, failed, total: parties.length };
}

module.exports = recomputeAllPartyStats;
