const prisma = require('../config/prisma');
const logger = require('../core/logger');

/** Marks ACTIVE Opportunities whose expiresAt has passed as EXPIRED. */
async function expireOpportunities() {
  const result = await prisma.opportunity.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    logger.info(`Expired ${result.count} opportunity(ies)`);
  }
  return result.count;
}

module.exports = expireOpportunities;
