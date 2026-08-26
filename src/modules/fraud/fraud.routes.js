/**
 * @openapi
 * tags:
 *   name: Fraud
 *   description: Fraud Detection Engine — deteksi & review fake completed activity
 *
 * /fraud-flags:
 *   get:
 *     tags: [Fraud]
 *     summary: List insiden yang ditandai Fraud Detection Engine (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_REVIEW, CONFIRMED, DISMISSED] }
 *     responses:
 *       200: { description: Daftar FraudFlag }
 *
 * /fraud-flags/{id}:
 *   get:
 *     tags: [Fraud]
 *     summary: Detail satu FraudFlag beserta kedua Party & Deal terkait (admin only)
 *     security: [{ bearerAuth: [] }]
 *
 * /fraud-flags/{id}/review:
 *   patch:
 *     tags: [Fraud]
 *     summary: Admin memutuskan CONFIRMED (fraud nyata) atau DISMISSED (false positive)
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const { listFraudFlags, getFraudFlag, reviewFraudFlag } = require('./fraud.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  listFraudFlagsSchema,
  idParamSchema,
  reviewFraudFlagSchema,
} = require('../../validations/fraud.validation');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', validate(listFraudFlagsSchema), listFraudFlags);
router.get('/:id', validate(idParamSchema), getFraudFlag);
router.patch('/:id/review', validate(reviewFraudFlagSchema), reviewFraudFlag);

module.exports = router;
