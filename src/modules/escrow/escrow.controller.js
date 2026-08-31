const asyncHandler = require('../../utils/asyncHandler');
const { ApiResponse } = require('../../utils/apiResponse');
const escrowService = require('./escrow.service');

const initiateHold = asyncHandler(async (req, res) => {
  const callerProfileId = req.profile?.id;
  const result = await escrowService.initiateHold({
    ...req.body,
    callerProfileId,
  });

  return ApiResponse.created(res, result, 'Escrow transaction initiated and funds held');
});

const confirmBySeller = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const callerProfileId = req.profile?.id;
  const result = await escrowService.confirmBySeller({
    escrowId: id,
    callerProfileId,
    notes: req.body?.notes,
    metadata: req.body?.metadata,
  });

  return ApiResponse.success(res, result, 'Seller fulfillment confirmed successfully');
});

const confirmByBuyer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const callerProfileId = req.profile?.id;
  const result = await escrowService.confirmByBuyer({
    escrowId: id,
    callerProfileId,
    notes: req.body?.notes,
    autoRelease: req.body?.autoRelease,
  });

  return ApiResponse.success(res, result, 'Buyer receipt confirmed successfully');
});

const releaseFunds = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const callerProfileId = req.profile?.id;
  const result = await escrowService.releaseFunds({
    escrowId: id,
    callerProfileId,
    notes: req.body?.notes,
  });

  return ApiResponse.success(res, result, 'Escrow funds successfully released to seller');
});

const refundEscrow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const callerProfileId = req.profile?.id;
  const result = await escrowService.refundEscrow({
    escrowId: id,
    callerProfileId,
    reason: req.body?.reason,
  });

  return ApiResponse.success(res, result, 'Escrow funds refunded to buyer');
});

const disputeEscrow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const callerProfileId = req.profile?.id;
  const result = await escrowService.disputeEscrow({
    escrowId: id,
    callerProfileId,
    disputeReason: req.body?.disputeReason,
  });

  return ApiResponse.success(res, result, 'Escrow placed in dispute');
});

const getEscrow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await escrowService.getEscrowById(id);
  return ApiResponse.success(res, result, 'Escrow transaction details retrieved');
});

const listEscrows = asyncHandler(async (req, res) => {
  const profileId = req.profile?.id;
  const { partyId, status, page, limit } = req.query || {};
  const result = await escrowService.listEscrowTransactions({
    partyId,
    profileId,
    status,
    page,
    limit,
  });

  return ApiResponse.paginated(res, result.items, result.meta, 'Escrow transactions list retrieved');
});

module.exports = {
  initiateHold,
  confirmBySeller,
  confirmByBuyer,
  releaseFunds,
  refundEscrow,
  disputeEscrow,
  getEscrow,
  listEscrows,
};
