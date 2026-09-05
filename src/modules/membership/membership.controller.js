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
  const result = await membershipService.checkout({
    profileId: req.profile.id,
    planId,
    voucherCode,
    idempotencyKey,
  });
  return created(res, result, 'Checkout created — arahkan user ke paymentUrl untuk membayar');
});

/**
 * Webhook publik — selalu 200 jika signature valid (termasuk UNKNOWN_ORDER),
 * supaya Midtrans tidak spam retry. Signature invalid tetap 403.
 */
const webhook = asyncHandler(async (req, res) => {
  const provider = (req.params.provider || 'midtrans').toUpperCase();
  const result = await membershipService.handlePaymentWebhook(provider, req.body);

  if (result && result.acknowledged) {
    return success(res, result, 'Webhook acknowledged');
  }
  return success(res, null, 'Webhook processed');
});

const listMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await membershipService.listMyTransactions(req.profile.id);
  return success(res, transactions);
});

const devActivate = asyncHandler(async (req, res) => {
  if (env.nodeEnv === 'production') {
    throw ApiError.forbidden(
      'Dev stub ini dinonaktifkan di production. Gunakan payment gateway sungguhan.',
      ErrorCodes.FORBIDDEN
    );
  }
  const { durationDays } = req.body;
  const membership = await membershipService.devActivate({
    profileId: req.profile.id,
    durationDays,
  });
  return success(
    res,
    membership,
    'Membership diaktifkan (DEV STUB — bukan lewat payment gateway)'
  );
});

module.exports = {
  listPlans,
  getMyMembership,
  checkout,
  webhook,
  listMyTransactions,
  devActivate,
};
