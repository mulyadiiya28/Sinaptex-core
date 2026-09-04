const router = require('express').Router();
const { requireVerifiedSession } = require('../../middlewares/auth.middleware');
const { requireEscrowParticipant } = require('../../middlewares/escrowAuth.middleware');
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
router.post(
  '/:id/seller-confirm',
  validate(sellerConfirmSchema),
  requireEscrowParticipant('SELLER'),
  confirmBySeller
);
router.post(
  '/:id/buyer-confirm',
  validate(buyerConfirmSchema),
  requireEscrowParticipant('BUYER'),
  confirmByBuyer
);
router.post(
  '/:id/release',
  validate(releaseFundsSchema),
  requireEscrowParticipant('BUYER'),
  releaseFunds
);
router.post(
  '/:id/refund',
  validate(refundSchema),
  requireEscrowParticipant('ANY'),
  refundEscrow
);
router.post(
  '/:id/dispute',
  validate(disputeSchema),
  requireEscrowParticipant('ANY'),
  disputeEscrow
);
router.get(
  '/:id',
  validate(escrowIdParamSchema),
  requireEscrowParticipant('ANY'),
  getEscrow
);
// List remains scoped via profileId inside the service layer
router.get('/', validate(listEscrowsSchema), listEscrows);

module.exports = router;
