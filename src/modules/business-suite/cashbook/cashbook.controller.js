const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const cashbookService = require('./cashbook.service');

const addEntry = asyncHandler(async (req, res) => {
  const entry = await cashbookService.addEntry({
    ...req.body,
    partyId: req.params.partyId,
    createdBy: req.profile?.id,
  });
  return created(res, entry, 'Entry kas berhasil ditambahkan');
});

const listEntries = asyncHandler(async (req, res) => {
  const result = await cashbookService.listEntries(req.params.partyId, req.query);
  return success(res, result.items, 'OK', 200, { ...result.meta, summary: result.summary });
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await cashbookService.getSummary(req.params.partyId);
  return success(res, summary);
});

const deleteEntry = asyncHandler(async (req, res) => {
  await cashbookService.deleteEntry(req.params.entryId, req.params.partyId, req.profile?.id);
  return success(res, null, 'Entry dihapus');
});

module.exports = { addEntry, listEntries, getSummary, deleteEntry };
