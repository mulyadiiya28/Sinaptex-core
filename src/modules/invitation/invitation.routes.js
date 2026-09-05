/**
 * @openapi
 * tags:
 *   name: Invitations
 *   description: |
 *     Jalur formal Match → Invitation → Deal. Lihat `docs/state-machines.md`
 *     untuk diagram transisi status Deal.
 *
 * /invitations:
 *   post:
 *     tags: [Invitations]
 *     summary: Kirim invitation dari sebuah hasil Match
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matchId]
 *             properties:
 *               matchId: { type: string, format: uuid }
 *               message: { type: string, maxLength: 500 }
 *     responses:
 *       201: { description: Invitation dikirim, status PENDING }
 *       400: { description: Validasi gagal }
 *       403: { description: Bukan pemilik Match/Opportunity terkait }
 *       409: { description: Invitation untuk Match ini sudah ada, atau fraud gate memblokir }
 *
 * /invitations/me:
 *   get:
 *     tags: [Invitations]
 *     summary: List invitation milik Party sendiri (dikirim maupun diterima)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar invitation }
 *       401: { description: Token tidak ada/invalid }
 *
 * /invitations/{id}/respond:
 *   patch:
 *     tags: [Invitations]
 *     summary: Accept/Reject invitation — hanya pihak penerima
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
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [ACCEPT, REJECT] }
 *     responses:
 *       200: { description: Invitation diperbarui; ACCEPT membuat Deal baru berstatus NEGOTIATION }
 *       403: { description: Bukan penerima invitation }
 *       409: { description: Invitation sudah direspons sebelumnya }
 *
 * /invitations/deals/me:
 *   get:
 *     tags: [Invitations]
 *     summary: List Deal milik Party sendiri
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar Deal }
 *       401: { description: Token tidak ada/invalid }
 *
 * /invitations/deals/{id}:
 *   patch:
 *     tags: [Invitations]
 *     summary: Update status Deal (state machine NEGOTIATION → DEAL → IN_PROGRESS → COMPLETED/CANCELLED/EXPIRED)
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [NEGOTIATION, DEAL, IN_PROGRESS, COMPLETED, CANCELLED, EXPIRED] }
 *               agreedTerms: { type: object }
 *               notes: { type: string, maxLength: 1000 }
 *               cancelReason:
 *                 type: string
 *                 maxLength: 300
 *                 description: Wajib diisi bila status CANCELLED
 *     responses:
 *       200: { description: Deal diperbarui }
 *       400: { description: cancelReason wajib diisi ketika status CANCELLED, atau transisi status tidak valid }
 *       403: { description: Bukan pihak terkait di Deal ini }
 *       404: { description: Deal tidak ditemukan }
 */
const router = require('express').Router();
const { createInvitation, listMyInvitations, respondInvitation } = require('./invitation.controller');
const { listMyDeals, updateDeal } = require('./deal.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  createInvitationSchema,
  respondInvitationSchema,
  updateDealSchema,
} = require('../../validations/invitation.validation');

// Invitations
router.post('/', requireAuth, validate(createInvitationSchema), createInvitation);
router.get('/me', requireAuth, listMyInvitations);
router.patch('/:id/respond', requireAuth, validate(respondInvitationSchema), respondInvitation);

// Deals (nested under the same "collaboration" domain)
router.get('/deals/me', requireAuth, listMyDeals);
router.patch('/deals/:id', requireAuth, validate(updateDealSchema), updateDeal);

module.exports = router;
