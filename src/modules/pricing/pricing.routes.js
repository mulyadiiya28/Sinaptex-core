/**
 * @openapi
 * tags:
 *   name: Pricing
 *   description: |
 *     Domain Pricing terpisah dari Membership (System > Membership | Pricing | Payment).
 *     Mengubah harga TIDAK mengubah MembershipPlan — hanya menambah baris
 *     MembershipPricing baru, harga lama diarsipkan (histori invoice tetap utuh).
 *
 * /pricing/plans/{planId}:
 *   post:
 *     tags: [Pricing]
 *     summary: Tetapkan harga baru untuk sebuah plan (admin only)
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Pricing]
 *     summary: Riwayat harga sebuah plan (admin only)
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const { setPlanPrice, getPriceHistory } = require('./pricing.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { planIdParamSchema, setPlanPriceSchema } = require('../../validations/pricing.validation');

router.use(requireAuth, requireRole('ADMIN'));

router.post('/plans/:planId', validate(setPlanPriceSchema), setPlanPrice);
router.get('/plans/:planId', validate(planIdParamSchema), getPriceHistory);

module.exports = router;
