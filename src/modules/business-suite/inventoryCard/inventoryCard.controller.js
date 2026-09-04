const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('./inventoryCard.service');

const addEntry = asyncHandler(async (req, res) => {
  const entry = await service.addEntry({
    ...req.body,
    partyId: req.params.partyId,
    productId: req.params.productId,
    variantId: req.body.variantId || null,
    createdBy: req.profile.id,
  });
  return created(res, entry, 'Entri kartu persediaan ditambahkan');
});

const listEntries = asyncHandler(async (req, res) => {
  const result = await service.listEntries(
    req.params.partyId,
    req.params.productId,
    req.query.variantId,
    req.query
  );
  return success(res, { card: result.card, entries: result.items }, 'OK', 200, result.meta);
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await service.getCardSummary(
    req.params.partyId,
    req.params.productId,
    req.query.variantId
  );
  return success(res, summary);
});

const listAll = asyncHandler(async (req, res) => {
  const result = await service.listAllCards(req.params.partyId, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

module.exports = { addEntry, listEntries, getSummary, listAll };
