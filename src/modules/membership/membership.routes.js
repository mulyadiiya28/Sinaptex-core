/**
 * @openapi
 * tags:
 *   name: Membership
 *   description: MVP Phase 4 — domain Membership terpisah dari Profile (lihat catatan review Chat di PROJECT_CHECKLIST.md)
 *
 * /membership/plans:
 *   get:
 *     tags: [Membership]
 *     summary: List paket membership (publik)
 *
 * /membership/me:
 *   get:
 *     tags: [Membership]
 *     summary: Status membership saya saat ini
 *     security: [{ bearerAuth: [] }]
 *
 * /membership/checkout:
 *   post:
 *     tags: [Membership]
 *     summary: Mulai transaksi pembayaran (Midtrans Snap), dapat redirectUrl
 *     security: [{ bearerAuth: [] }]
 *
 * /membership/webhook/{provider}:
 *   post:
 *     tags: [Membership]
 *     summary: Webhook notifikasi payment gateway (dipanggil server provider, bukan user — signature-verified per adapter)
 *
 * /membership/transactions/me:
 *   get:
 *     tags: [Membership]
 *     summary: Riwayat transaksi/invoice saya
 *     security: [{ bearerAuth: [] }]
 *
 * /membership/dev-activate:
 *   post:
 *     tags: [Membership]
 *     summary: STUB DEV — aktivasi manual tanpa payment gateway (diblokir di production)
 *     security: [{ bearerAuth: [] }]
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
const { checkoutSchema, webhookSchema, devActivateSchema } = require('../../validations/membership.validation');

router.get('/plans', listPlans);
router.get('/me', requireVerifiedSession(), getMyMembership);
router.post('/checkout', requireVerifiedSession(), validate(checkoutSchema), checkout);
router.post('/webhook/:provider', validate(webhookSchema), webhook); // publik, keamanan via signature per-adapter
router.post('/midtrans/webhook', (req, res, next) => {
  req.params.provider = 'midtrans';
  return webhook(req, res, next);
});
router.post('/webhook', (req, res, next) => {
  req.params.provider = 'midtrans';
  return webhook(req, res, next);
});
router.get('/transactions/me', requireVerifiedSession(), listMyTransactions);
router.post('/dev-activate', requireVerifiedSession(), validate(devActivateSchema), devActivate);

module.exports = router;
