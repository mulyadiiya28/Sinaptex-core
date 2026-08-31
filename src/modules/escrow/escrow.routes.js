const router = require('express').Router();
const { requireVerifiedSession } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  initiateHold,
  confirmBySeller,
  confirmByBuyer,
  releaseFunds,
  refundEscrow,
  disputeEscrow,
  getEscrow,
  listEscrows,
} = require('./escrow.controller');
const {
  initiateHoldSchema,
  escrowIdParamSchema,
  sellerConfirmSchema,
  buyerConfirmSchema,
  releaseFundsSchema,
  refundSchema,
  disputeSchema,
  listEscrowsSchema,
} = require('../../validations/escrow.validation');

// Protect all escrow endpoints: requires authenticated and verified user session
router.use(requireVerifiedSession());

router.post('/hold', validate(initiateHoldSchema), initiateHold);
router.post('/:id/seller-confirm', validate(sellerConfirmSchema), confirmBySeller);
router.post('/:id/buyer-confirm', validate(buyerConfirmSchema), confirmByBuyer);
router.post('/:id/release', validate(releaseFundsSchema), releaseFunds);
router.post('/:id/refund', validate(refundSchema), refundEscrow);
router.post('/:id/dispute', validate(disputeSchema), disputeEscrow);
router.get('/:id', validate(escrowIdParamSchema), getEscrow);
router.get('/', validate(listEscrowsSchema), listEscrows);

module.exports = router;
