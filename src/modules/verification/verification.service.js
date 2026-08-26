const prisma = require('../../config/prisma');

/**
 * Recomputes the aggregate verification status for a Profile or Party
 * from its individual documents:
 *  - no documents            -> UNVERIFIED
 *  - any document PENDING    -> PENDING
 *  - any document REJECTED   -> REJECTED (needs re-submission)
 *  - all documents VERIFIED  -> VERIFIED
 */
async function recomputeAggregateStatus({ profileId, partyId }) {
  const where = profileId ? { profileId } : { partyId };
  const docs = await prisma.verificationDocument.findMany({ where });

  let status = 'UNVERIFIED';
  if (docs.length > 0) {
    if (docs.some((d) => d.status === 'PENDING')) status = 'PENDING';
    else if (docs.some((d) => d.status === 'REJECTED')) status = 'REJECTED';
    else if (docs.every((d) => d.status === 'VERIFIED')) status = 'VERIFIED';
    else status = 'PENDING';
  }

  if (profileId) {
    await prisma.profile.update({ where: { id: profileId }, data: { verificationStatus: status } });
  } else {
    await prisma.party.update({ where: { id: partyId }, data: { verificationStatus: status } });
  }
  return status;
}

module.exports = { recomputeAggregateStatus };
