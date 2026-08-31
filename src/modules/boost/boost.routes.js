/**
 * @openapi
 * tags:
 *   name: Boost
 *   description: |
 *     Paket prioritas Opportunity. FREE aktif langsung.
 *     BASIC/PREMIUM/VIP via Midtrans Snap; webhook membership juga memproses order BOOST-*.
 *
 * /boosts/plans:
 *   get:
 *     tags: [Boost]
 *     summary: List paket boost
 *
 * /boosts/{opportunityId}/checkout:
 *   post:
 *     tags: [Boost]
 *     summary: Checkout/aktivasi boost (FREE langsung, berbayar dapat paymentUrl)
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const { listPlans, checkout } = require('./boost.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { checkoutBoostSchema } = require('../../validations/boost.validation');

router.get('/plans', listPlans);
router.post('/:opportunityId/checkout', requireAuth, validate(checkoutBoostSchema), checkout);

// Alias lama (deprecated): /:opportunityId/activate → sama dengan checkout
router.post('/:opportunityId/activate', requireAuth, validate(checkoutBoostSchema), checkout);

module.exports = router;
