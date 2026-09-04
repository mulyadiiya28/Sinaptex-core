const prisma = require('../../config/prisma');
const logger = require('../../core/logger');
const config = require('../../config/marketplace.config');

/**
 * Ensure buyer has a Party (auto-create "Personal" if not exists).
 * Called before checkout / escrow creation.
 */
async function ensureBuyerParty(profileId) {
  if (!config.order.autoCreateBuyerParty) {
    const existing = await prisma.party.findFirst({
      where: { ownerId: profileId },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) {
      throw new Error('Buyer does not have a Party and auto-create is disabled');
    }
    return existing;
  }

  let party = await prisma.party.findFirst({
    where: { ownerId: profileId },
    orderBy: { createdAt: 'asc' },
  });

  if (!party) {
    party = await prisma.party.create({
      data: {
        ownerId: profileId,
        name: config.order.buyerPartyName,
        type: 'INDIVIDUAL',
        industry: 'Lainnya',
        verificationStatus: 'VERIFIED',
      },
    });
    logger.info('Auto-created buyer Party', { profileId, partyId: party.id });
  }

  return party;
}

module.exports = { ensureBuyerParty };
