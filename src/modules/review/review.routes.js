/**
 * @openapi
 * tags:
 *   name: Reviews
 *   description: Review pasca-Deal (reputasi antar Party) — beda dengan review produk marketplace
 *
 * /reviews/deals/{dealId}:
 *   post:
 *     tags: [Reviews]
 *     summary: Beri review untuk pihak lain pasca-deal
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [revieweeId, rating]
 *             properties:
 *               revieweeId: { type: string, format: uuid }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 1000 }
 *     responses:
 *       201: { description: Review dibuat }
 *       400: { description: Validasi gagal }
 *       403: { description: Bukan pihak terkait di Deal, atau Deal belum Completed }
 *       409: { description: Sudah pernah mereview pihak ini untuk Deal ini }
 *
 * /reviews/profile/{profileId}:
 *   get:
 *     tags: [Reviews]
 *     summary: List review yang diterima seorang profile (publik)
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Daftar review + rata-rata rating }
 */
const { z } = require('zod');
const router = require('express').Router();
const { createReview, listPartyReviews } = require('./review.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createReviewSchema } = require('../../validations/review.validation');

router.post('/deals/:dealId', requireAuth, validate(createReviewSchema), createReview);
router.get(
  '/profile/:profileId',
  validate({ params: z.object({ profileId: z.string().uuid() }) }),
  listPartyReviews
);

module.exports = router;
