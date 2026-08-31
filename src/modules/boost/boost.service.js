const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const PaymentGateway = require('../../core/payment/PaymentGateway');
const PaymentStatus = require('../../core/payment/PaymentStatus');
const logger = require('../../core/logger');

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

function amountsMatch(expected, received) {
  if (expected == null || received == null) return false;
  return Math.abs(Number(expected) - Number(received)) < 1;
}

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

  const boost = await prisma.opportunityBoost.upsert({
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

async function handlePaymentWebhook(provider, payload) {
  const gateway = PaymentGateway.of(provider);
  const result = gateway.verifyWebhook(payload);

  if (!result.valid) {
    logger.warn('Boost webhook: invalid signature', { provider, orderId: result.orderId });
    throw ApiError.forbidden('Invalid webhook signature', ErrorCodes.WEBHOOK_INVALID_SIGNATURE);
  }

  const orderId = result.orderId || '';
  if (!orderId.startsWith(BOOST_ORDER_PREFIX)) {
    return { acknowledged: true, reason: 'NOT_BOOST_ORDER', orderId };
  }

  const boostId = orderId.slice(BOOST_ORDER_PREFIX.length);
  const boost = await prisma.opportunityBoost.findUnique({
    where: { id: boostId },
    include: { plan: true },
  });

  if (!boost) {
    logger.warn('Boost webhook: unknown boost order acknowledged', { orderId, boostId });
    return { acknowledged: true, reason: 'UNKNOWN_ORDER', orderId };
  }

  if (boost.paymentStatus === PaymentStatus.PAID) {
    logger.info('Boost webhook: already PAID, idempotent no-op', { boostId });
    return boost;
  }

  if ([PaymentStatus.FAILED, PaymentStatus.EXPIRED].includes(boost.paymentStatus)) {
    // Terminal non-paid — still allow transition only from PENDING via claim below
    if (boost.paymentStatus !== PaymentStatus.PENDING) {
      return boost;
    }
  }

  if (result.status === PaymentStatus.PAID) {
    if (!amountsMatch(boost.plan.price, result.grossAmount)) {
      logger.error('Boost webhook: amount mismatch', {
        orderId,
        expected: boost.plan.price,
        received: result.grossAmount,
      });
      throw ApiError.forbidden('Webhook amount mismatch', ErrorCodes.WEBHOOK_INVALID_SIGNATURE);
    }

    const startAt = new Date();
    const expiredAt = computeExpiry(startAt, boost.plan.durationDays);

    const claimed = await prisma.opportunityBoost.updateMany({
      where: { id: boostId, paymentStatus: PaymentStatus.PENDING },
      data: {
        paymentStatus: PaymentStatus.PAID,
        startAt,
        expiredAt,
      },
    });

    if (claimed.count === 0) {
      return prisma.opportunityBoost.findUnique({
        where: { id: boostId },
        include: { plan: true },
      });
    }

    logger.info('Boost activated via payment', { boostId, opportunityId: boost.opportunityId });
    return prisma.opportunityBoost.findUnique({
      where: { id: boostId },
      include: { plan: true },
    });
  }

  // FAILED / EXPIRED — map cancel ke FAILED (enum boost tidak punya CANCELLED)
  const terminal =
    result.status === PaymentStatus.FAILED || result.status === PaymentStatus.EXPIRED
      ? result.status
      : result.status === 'CANCELLED'
        ? PaymentStatus.FAILED
        : null;

  if (terminal) {
    await prisma.opportunityBoost.updateMany({
      where: { id: boostId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: terminal },
    });
    return prisma.opportunityBoost.findUnique({
      where: { id: boostId },
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
  amountsMatch,
};
