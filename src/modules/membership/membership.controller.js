const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const membershipService = require('./membership.service');

const listPlans = asyncHandler(async (req, res) => {
  const plans = await membershipService.listPlans();
  return success(res, plans);
});

const getMyMembership = asyncHandler(async (req, res) => {
  const membership = await membershipService.getOrCreateMembership(req.profile.id);
  return success(res, membership);
});

const checkout = asyncHandler(async (req, res) => {
  const { planId, voucherCode } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] || undefined;
  const result = await membershipService.checkout({ profileId: req.profile.id, planId, voucherCode, idempotencyKey });
  return created(res, result, 'Checkout created — arahkan user ke paymentUrl untuk membayar');
});

// Endpoint publik (dipanggil server payment gateway, bukan user) — tidak pakai
// requireAuth, keamanan ditegakkan lewat verifikasi signature per-adapter
// (lihat PaymentGateway.of(provider).verifyWebhook() di membershipService).
// :provider di path supaya siap multi-gateway tanpa endpoint baru per provider.
const webhook = asyncHandler(async (req, res) => {
  await membershipService.handlePaymentWebhook(req.params.provider.toUpperCase(), req.body);
  return success(res, null, 'Webhook processed');
});

const listMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await membershipService.listMyTransactions(req.profile.id);
  return success(res, transactions);
});

/** STUB DEV — lihat komentar di membership.service.js. Diblokir keras di production. */
const devActivate = asyncHandler(async (req, res) => {
  if (env.nodeEnv === 'production') {
    throw ApiError.forbidden('Dev stub ini dinonaktifkan di production. Gunakan payment gateway sungguhan.', ErrorCodes.FORBIDDEN);
  }
  const { durationDays } = req.body;
  const membership = await membershipService.devActivate({ profileId: req.profile.id, durationDays });
  return success(res, membership, 'Membership diaktifkan (DEV STUB — bukan lewat payment gateway)');
});

module.exports = { listPlans, getMyMembership, checkout, webhook, listMyTransactions, devActivate };
