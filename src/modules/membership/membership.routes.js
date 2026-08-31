/**
 * @openapi
 * tags:
 *   name: Membership
 *   description: MVP Phase 4 — Membership + Midtrans webhook (signature-verified)
 */
const router = require('express').Router();
const {
  listPlans,
  getMyMembership,
  checkout,
  webhook,
  listMyTransactions,
  devActivate,
} = require('./membership.controller');
const { requireVerifiedSession } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { webhookLimiter, strictLimiter } = require('../../middlewares/rateLimit.middleware');
const {
  checkoutSchema,
  webhookSchema,
  webhookBodySchema,
  devActivateSchema,
} = require('../../validations/membership.validation');

router.get('/plans', listPlans);
router.get('/me', requireVerifiedSession(), getMyMembership);
router.post(
  '/checkout',
  requireVerifiedSession(),
  strictLimiter,
  validate(checkoutSchema),
  checkout
);

router.post('/webhook/:provider', webhookLimiter, validate(webhookSchema), webhook);
router.post('/midtrans/webhook', webhookLimiter, validate(webhookBodySchema), (req, res, next) => {
  req.params.provider = 'midtrans';
  return webhook(req, res, next);
});
router.post('/webhook', webhookLimiter, validate(webhookBodySchema), (req, res, next) => {
  req.params.provider = 'midtrans';
  return webhook(req, res, next);
});

router.get('/transactions/me', requireVerifiedSession(), listMyTransactions);
router.post(
  '/dev-activate',
  requireVerifiedSession(),
  strictLimiter,
  validate(devActivateSchema),
  devActivate
);

module.exports = router;
