const crypto = require('crypto');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const PaymentGateway = require('../../core/payment/PaymentGateway');
const PaymentStatus = require('../../core/payment/PaymentStatus');
const logger = require('../../core/logger');

/**
 * BOOST — aktivasi paket prioritas Opportunity.
 * FREE: aktif langsung (PAID).
 * BASIC/PREMIUM/VIP: checkout Midtrans Snap; webhook yang mengaktifkan (bukan client).
 *
 * orderId gateway: `BOOST-{boostId}` agar webhook bisa resolve tanpa tabel transaksi terpisah.
 */

const BOOST_ORDER_PREFIX = 'BOOST-';

async function assertOpportunityOwner(opportunityId, profileId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { party: true, boost: true },
  });
  if (!opportunity) throw ApiError.notFound('Opportunity not found');
  if (opportunity.party.ownerId !== profileId) {
    throw ApiError.forbidden('Hanya pemilik opportunity yang boleh mengaktifkan boost');
  }
  return opportunity;
}

function computeExpiry(startAt, durationDays) {
  return new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

/** FREE atau aktivasi setelah bayar sukses. */
async function applyPaidBoost({ opportunityId, plan }) {
  const startAt = new Date();
  const expiredAt = computeExpiry(startAt, plan.durationDays);

  return prisma.opportunityBoost.upsert({
    where: { opportunityId },
    update: {
      planId: plan.id,
      priorityWeight: plan.priorityWeight,
      startAt,
      expiredAt,
      paymentStatus: PaymentStatus.PAID,
    },
    create: {
      opportunityId,
      planId: plan.id,
      priorityWeight: plan.priorityWeight,
      startAt,
      expiredAt,
      paymentStatus: PaymentStatus.PAID,
    },
    include: { plan: true },
  });
}

/**
 * Checkout boost:
 * - FREE → aktif langsung, tanpa gateway
 * - berbayar → buat/update row PENDING + Snap redirectUrl
 */
async function checkout({ opportunityId, profileId, planType }) {
  const opportunity = await assertOpportunityOwner(opportunityId, profileId);
  const plan = await prisma.boostPlan.findUnique({ where: { type: planType } });
  if (!plan) {
    throw ApiError.notFound(
      `Boost plan ${planType} not configured. Run the seed script.`,
      ErrorCodes.PLAN_NOT_FOUND
    );
  }

  if (planType === 'FREE' || plan.price <= 0) {
    const boost = await applyPaidBoost({ opportunityId, plan });
    return { boost, paymentUrl: null, token: null, free: true };
  }

  const startAt = new Date();
  const expiredAt = computeExpiry(startAt, plan.durationDays);

  // PENDING: prioritas belum dihitung sebagai aktif sampai paymentStatus === PAID
  // (ranking service harus cek paymentStatus; lihat catatan di bawah).
  let boost = await prisma.opportunityBoost.upsert({
    where: { opportunityId },
    update: {
      planId: plan.id,
      priorityWeight: plan.priorityWeight,
      startAt,
      expiredAt,
      paymentStatus: PaymentStatus.PENDING,
    },
    create: {
      opportunityId,
      planId: plan.id,
      priorityWeight: plan.priorityWeight,
      startAt,
      expiredAt,
      paymentStatus: PaymentStatus.PENDING,
    },
    include: { plan: true },
  });

  const orderId = `${BOOST_ORDER_PREFIX}${boost.id}`;
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });

  try {
    const gateway = PaymentGateway.getDefault();
    const payment = await gateway.createTransaction({
      orderId,
      grossAmount: plan.price,
      customer: {
        name: profile?.fullName || 'User',
        email: profile?.user?.email,
        phone: profile?.phone,
      },
      itemName: `Boost ${plan.name}: ${opportunity.title?.slice(0, 40) || opportunityId}`,
    });

    return {
      boost,
      paymentUrl: payment.paymentUrl,
      token: payment.token,
      orderId,
      free: false,
    };
  } catch (err) {
    await prisma.opportunityBoost.update({
      where: { id: boost.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
    throw ApiError.internal(
      `Gagal membuat transaksi boost: ${err.message}`,
      ErrorCodes.PAYMENT_FAILED
    );
  }
}

/**
 * Webhook handler untuk orderId ber-prefix BOOST-.
 * Dipanggil dari membership webhook router jika transaksi membership tidak ketemu.
 * @returns {object|null} boost updated, atau null jika bukan order boost / tidak valid
 */
async function handlePaymentWebhook(provider, payload) {
  const gateway = PaymentGateway.of(provider);
  const result = gateway.verifyWebhook(payload);

  if (!result.valid) {
    logger.warn('Boost webhook: invalid signature', { provider, orderId: result.orderId });
    throw ApiError.forbidden('Invalid webhook signature', ErrorCodes.WEBHOOK_INVALID_SIGNATURE);
  }

  const orderId = result.orderId || '';
  if (!orderId.startsWith(BOOST_ORDER_PREFIX)) {
    return null; // bukan order boost
  }

  const boostId = orderId.slice(BOOST_ORDER_PREFIX.length);
  const boost = await prisma.opportunityBoost.findUnique({
    where: { id: boostId },
    include: { plan: true },
  });

  if (!boost) {
    logger.warn('Boost webhook: boost not found', { orderId, boostId });
    throw ApiError.notFound('Boost transaction not found', ErrorCodes.TRANSACTION_NOT_FOUND);
  }

  if (boost.paymentStatus === PaymentStatus.PAID) {
    logger.info('Boost webhook: already PAID, idempotent no-op', { boostId });
    return boost;
  }

  if (result.status === PaymentStatus.PAID) {
    const startAt = new Date();
    const expiredAt = computeExpiry(startAt, boost.plan.durationDays);
    const updated = await prisma.opportunityBoost.update({
      where: { id: boostId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        startAt,
        expiredAt,
      },
      include: { plan: true },
    });
    logger.info('Boost activated via payment', { boostId, opportunityId: boost.opportunityId });
    return updated;
  }

  if ([PaymentStatus.FAILED, PaymentStatus.EXPIRED, PaymentStatus.CANCELLED].includes(result.status)) {
    return prisma.opportunityBoost.update({
      where: { id: boostId },
      data: { paymentStatus: result.status },
      include: { plan: true },
    });
  }

  return boost;
}

function isBoostOrderId(orderId) {
  return typeof orderId === 'string' && orderId.startsWith(BOOST_ORDER_PREFIX);
}

module.exports = {
  checkout,
  applyPaidBoost,
  handlePaymentWebhook,
  isBoostOrderId,
  BOOST_ORDER_PREFIX,
};
