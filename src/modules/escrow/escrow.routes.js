/**
 * @openapi
 * tags:
 *   name: Escrow
 *   description: |
 *     Hold/confirm/release/refund/dispute dana antara Buyer & Seller Party.
 *     Semua endpoint butuh sesi terverifikasi (`requireVerifiedSession`) —
 *     lihat `docs/state-machines.md` untuk diagram transisi status Escrow.
 *
 * /escrow/hold:
 *   post:
 *     tags: [Escrow]
 *     summary: Mulai hold dana escrow antara Buyer & Seller Party
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [buyerPartyId, sellerPartyId, amount]
 *             properties:
 *               buyerPartyId: { type: string, format: uuid }
 *               sellerPartyId: { type: string, format: uuid }
 *               amount: { type: number, exclusiveMinimum: 0 }
 *               fee: { type: number, minimum: 0, default: 0 }
 *               currency: { type: string, maxLength: 10, default: IDR }
 *               dealId: { type: string, format: uuid, nullable: true }
 *               notes: { type: string, maxLength: 1000, nullable: true }
 *               metadata: { type: object, nullable: true }
 *     responses:
 *       201: { description: Escrow dibuat berstatus PENDING_HOLD/HELD }
 *       400: { description: Validasi gagal }
 *       403: { description: Sesi belum terverifikasi }
 *
 * /escrow:
 *   get:
 *     tags: [Escrow]
 *     summary: List Escrow milik Party sendiri (di-scope di service layer via profileId)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: partyId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_HOLD, HELD, BUYER_CONFIRMED, SELLER_CONFIRMED, RELEASED, REFUNDED, DISPUTED, CANCELLED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar Escrow dengan meta pagination }
 *
 * /escrow/{id}:
 *   get:
 *     tags: [Escrow]
 *     summary: Detail satu Escrow
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Detail Escrow }
 *       403: { description: Bukan Buyer/Seller Party terkait }
 *       404: { description: Escrow tidak ditemukan }
 *
 * /escrow/{id}/seller-confirm:
 *   post:
 *     tags: [Escrow]
 *     summary: Konfirmasi Seller (barang/jasa terkirim) — hanya Seller Party terkait
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, maxLength: 1000 }
 *               metadata: { type: object }
 *     responses:
 *       200: { description: Escrow berstatus SELLER_CONFIRMED }
 *       403: { description: Bukan Seller Party terkait }
 *       409: { description: Transisi status tidak valid }
 *
 * /escrow/{id}/buyer-confirm:
 *   post:
 *     tags: [Escrow]
 *     summary: Konfirmasi Buyer (barang/jasa diterima) — hanya Buyer Party terkait
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, maxLength: 1000 }
 *               autoRelease:
 *                 type: boolean
 *                 default: false
 *                 description: Langsung release dana begitu buyer konfirmasi
 *     responses:
 *       200: { description: Escrow berstatus BUYER_CONFIRMED (atau RELEASED bila autoRelease) }
 *       403: { description: Bukan Buyer Party terkait }
 *       409: { description: Transisi status tidak valid }
 *
 * /escrow/{id}/release:
 *   post:
 *     tags: [Escrow]
 *     summary: Release dana ke Seller — hanya Buyer Party terkait
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, maxLength: 1000 }
 *     responses:
 *       200: { description: Escrow berstatus RELEASED, dana diteruskan ke Seller }
 *       403: { description: Bukan Buyer Party terkait }
 *       409: { description: Transisi status tidak valid (mis. belum SELLER_CONFIRMED) }
 *
 * /escrow/{id}/refund:
 *   post:
 *     tags: [Escrow]
 *     summary: Refund dana ke Buyer (pembatalan mutual) — Buyer atau Seller Party terkait
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 500, default: 'Mutual cancellation' }
 *     responses:
 *       200: { description: Escrow berstatus REFUNDED }
 *       403: { description: Bukan Buyer/Seller Party terkait }
 *       409: { description: Transisi status tidak valid }
 *
 * /escrow/{id}/dispute:
 *   post:
 *     tags: [Escrow]
 *     summary: Ajukan dispute atas Escrow — Buyer atau Seller Party terkait
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [disputeReason]
 *             properties:
 *               disputeReason: { type: string, minLength: 5, maxLength: 1000 }
 *     responses:
 *       200: { description: Escrow berstatus DISPUTED — menunggu tinjauan admin/fraud }
 *       400: { description: Validasi gagal (disputeReason kurang dari 5 karakter) }
 *       403: { description: Bukan Buyer/Seller Party terkait }
 *       409: { description: Escrow sudah RELEASED/REFUNDED, tidak bisa dispute }
 */
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
