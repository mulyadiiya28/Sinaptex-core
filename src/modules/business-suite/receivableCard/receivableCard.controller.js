const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('./receivableCard.service');

const addEntry = asyncHandler(async (req, res) => {
  const entry = await service.addEntry({
    ...req.body,
    partyId: req.params.partyId,
    contactId: req.params.contactId,
    createdBy: req.profile.id,
  });
  return created(res, entry, 'Entri kartu piutang ditambahkan');
});

const listEntries = asyncHandler(async (req, res) => {
  const result = await service.listEntries(req.params.partyId, req.params.contactId, req.query);
  return success(res, { card: result.card, entries: result.items }, 'OK', 200, result.meta);
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await service.getCardSummary(req.params.partyId, req.params.contactId);
  return success(res, summary);
});

module.exports = { addEntry, listEntries, getSummary };
