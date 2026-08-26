const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { handleIntent } = require('./intent.service');

const submitIntent = asyncHandler(async (req, res) => {
  const { text, partyId } = req.body;

  if (partyId && req.profile) {
    const party = await prisma.party.findFirst({ where: { id: partyId, ownerId: req.profile.id } });
    if (!party) throw ApiError.forbidden('You do not own this party');
  }

  const result = await handleIntent({ rawText: text, profileId: req.profile?.id, partyId });
  return success(res, result, 'Intent processed');
});

module.exports = { submitIntent };
