const prisma = require('../config/prisma');
const logger = require('../core/logger');
const { runFraudChecks } = require('../modules/fraud/fraud.service');

/**
 * Deal-completion fraud checks (fraud.service.js) run at the moment a Deal
 * transitions to COMPLETED. But concentration/pattern-based signals can drift
 * *after* that moment as more deals accumulate. This job re-scans Deal pairs
 * completed in the last 24h against the current, up-to-date pattern, catching
 * cases that looked fine in isolation but form a pattern in aggregate.
 */
async function fraudScan() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentDeals = await prisma.deal.findMany({
    where: { status: 'COMPLETED', endAt: { gte: since } },
    include: { invitation: { include: { fromParty: true, toParty: true } } },
  });

  // De-dupe by party pair — no need to re-run the same pair check multiple times per scan
  const seenPairs = new Set();
  let flagged = 0;

  for (const deal of recentDeals) {
    const { fromParty, toParty } = deal.invitation;
    const pairKey = [fromParty.id, toParty.id].sort().join(':');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    // eslint-disable-next-line no-await-in-loop
    const result = await runFraudChecks({
      partyA: fromParty,
      partyB: toParty,
      dealId: deal.id,
      invitationId: deal.invitationId,
    });
    if (result.findings.length > 0) flagged += 1;
  }

  logger.info(`Fraud scan complete: ${recentDeals.length} deal(s) checked, ${flagged} pair(s) flagged`);
  return { checked: recentDeals.length, flagged };
}

module.exports = fraudScan;
