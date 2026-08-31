const crypto = require('crypto');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const PaymentGateway = require('../../core/payment/PaymentGateway');
const pricingService = require('../pricing/pricing.service');
const logger = require('../../core/logger');

/**
 * MEMBERSHIP (MVP Phase 4) — domain terpisah dari Profile, Pricing, dan Payment.
 * -----------------------------------------------------------------------------
 * Modul lain (Chat, nanti Offer) TIDAK BOLEH baca status membership dari
 * Profile langsung — selalu lewat fungsi eksplisit di sini, misalnya:
 *   const active = await membershipService.hasActiveMembership(profileId);
 *
 * Harga TIDAK dihitung di sini — selalu lewat pricingService.calculate()
 * (domain Pricing terpisah). Pembayaran TIDAK bicara ke provider tertentu
 * secara langsung — selalu lewat PaymentGateway.getDefault() (factory/adapter,
 * lihat src/core/payment/). Ini yang membuat Membership tidak perlu berubah
 * kalau harga naik atau provider pembayaran diganti.
 */

/** Ambil-atau-buat record Membership untuk sebuah Profile (selalu ada, default INACTIVE). */
async function getOrCreateMembership(profileId) {
  const existing = await prisma.membership.findUnique({ where: { profileId } });
  if (existing) return existing;
  return prisma.membership.create({ data: { profileId, status: 'INACTIVE' } });
}

async function getActiveMembership(profileId) {
  const membership = await prisma.membership.findUnique({ where: { profileId } });
  if (!membership) return null;
  if (membership.status !== 'ACTIVE') return null;
  if (membership.expiresAt && membership.expiresAt < new Date()) return null;
  return membership;
}

/** Dipakai ConversationPolicy & modul lain — satu pertanyaan sederhana, tanpa expose detail internal. */
async function hasActiveMembership(profileId) {
  const active = await getActiveMembership(profileId);
  return Boolean(active);
}

async function listPlans() {
  const plans = await prisma.membershipPlan.findMany({
    include: { pricingHistory: { where: { status: 'ACTIVE' } } },
  });
  // Tampilkan harga AKTIF saja ke publik, bukan seluruh histori.
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    durationDays: p.durationDays,
    features: p.features,
    currentPrice: p.pricingHistory[0] || null,
  }));
}

function generateInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${datePart}-${randomPart}`;
}

/**
 * Mulai checkout: hitung harga lewat PricingService (BUKAN baca price langsung),
 * buat MembershipTransaction PENDING, lalu minta link pembayaran ke
 * PaymentGateway.getDefault() (BUKAN import Midtrans langsung). Membership
 * status BELUM berubah di sini — baru berubah kalau webhook konfirmasi PAID.
 *
 * IDEMPOTENCY: kalau client kirim `idempotencyKey` (dari header
 * `Idempotency-Key`, lihat membership.controller.js) dan key itu SUDAH pernah
 * dipakai sebelumnya, transaksi yang SAMA dikembalikan — tidak membuat
 * transaksi/tagihan baru. Ini mencegah double-charge kalau user klik tombol
 * bayar dua kali (mis. koneksi lambat, double-click).
 */
async function checkout({ profileId, planId, voucherCode, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await prisma.membershipTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      logger.info('Checkout idempotency hit — returning existing transaction', { idempotencyKey });
      return { transaction: existing, paymentUrl: existing.gatewayRedirectUrl, token: null, idempotentReplay: true };
    }
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw ApiError.notFound('Membership plan not found', ErrorCodes.PLAN_NOT_FOUND);

  const price = await pricingService.calculate({ productType: 'MEMBERSHIP', productId: planId, voucherCode });

  const membership = await getOrCreateMembership(profileId);
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, include: { user: true } });

  const invoiceNumber = generateInvoiceNumber();

  let transaction;
  try {
    transaction = await prisma.membershipTransaction.create({
      data: {
        membershipId: membership.id,
        planId: plan.id,
        pricingId: price.pricingId,
        amount: price.finalPrice, // snapshot harga saat ini — TIDAK ikut berubah kalau harga plan naik nanti
        status: 'PENDING',
        invoiceNumber,
        idempotencyKey: idempotencyKey || undefined,
      },
    });
  } catch (err) {
    // Race condition: dua request nyaris bersamaan dengan idempotencyKey yang
    // sama lolos pengecekan awal, lalu tabrakan di unique constraint DB.
    // Ambil transaksi yang menang, bukan lempar error ke user.
    if (err.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.membershipTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) return { transaction: existing, paymentUrl: existing.gatewayRedirectUrl, token: null, idempotentReplay: true };
    }
    throw err;
  }

  try {
    const gateway = PaymentGateway.getDefault();
    const payment = await gateway.createTransaction({
      orderId: invoiceNumber,
      grossAmount: price.finalPrice,
      customer: { name: profile.fullName, email: profile.user.email, phone: profile.phone },
      itemName: `Membership: ${plan.name}`,
    });

    const updated = await prisma.membershipTransaction.update({
      where: { id: transaction.id },
      data: { gatewayTransactionId: payment.transactionId, gatewayRedirectUrl: payment.paymentUrl },
    });

    return { transaction: updated, paymentUrl: payment.paymentUrl, token: payment.token, idempotentReplay: false };
  } catch (err) {
    // Payment gateway gagal dipanggil (mis. kredensial belum diset) — tandai transaksi
    // FAILED daripada menggantung selamanya di PENDING tanpa penjelasan.
    await prisma.membershipTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED' } });
    throw ApiError.internal(`Gagal membuat transaksi pembayaran: ${err.message}`, ErrorCodes.PAYMENT_FAILED);
  }
}

/**
 * Handler webhook payment gateway (provider apa pun, ditentukan oleh
 * `transaction.gatewayProvider`). Signature/verifikasi keaslian notifikasi
 * WAJIB valid sebelum status apa pun diproses — dilakukan oleh adapter
 * (PaymentGateway.of(provider).verifyWebhook()), bukan di sini.
 *
 * Juga meneruskan order BOOST-* ke boost.service (satu URL notifikasi Midtrans).
 *
 * IDEMPOTENCY: payment gateway bisa mengirim notifikasi yang sama berkali-kali.
 * Status terminal → no-op.
 */
async function handlePaymentWebhook(provider, payload) {
  const normalizedProvider = String(provider || 'MIDTRANS').toUpperCase();

  // Boost orders share the same Midtrans notification URL
  const boostService = require('../boost/boost.service');
  const orderIdHint = payload?.order_id || payload?.orderId;
  if (boostService.isBoostOrderId(orderIdHint)) {
    return boostService.handlePaymentWebhook(normalizedProvider, payload);
  }

  const gateway = PaymentGateway.of(normalizedProvider);
  const result = gateway.verifyWebhook(payload);

  if (!result.valid) {
    logger.warn('Payment webhook: invalid signature, ignoring', { provider: normalizedProvider, orderId: result.orderId });
    throw ApiError.forbidden('Invalid webhook signature', ErrorCodes.WEBHOOK_INVALID_SIGNATURE);
  }

  // Fallback: order boost yang lolos hint di atas
  if (boostService.isBoostOrderId(result.orderId)) {
    return boostService.handlePaymentWebhook(normalizedProvider, payload);
  }

  const transaction = await prisma.membershipTransaction.findFirst({
    where: {
      OR: [
        { gatewayTransactionId: result.orderId },
        { invoiceNumber: result.orderId },
      ],
    },
    include: {
      membership: {
        include: {
          profile: {
            include: {
              user: true,
            },
          },
        },
      },
      plan: true,
    },
  });
  if (!transaction) {
    logger.warn('Payment webhook: transaction not found', { provider: normalizedProvider, orderId: result.orderId });
    throw ApiError.notFound('Transaction not found', ErrorCodes.TRANSACTION_NOT_FOUND);
  }

  const TERMINAL_STATUSES = ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'];
  if (TERMINAL_STATUSES.includes(transaction.status)) {
    logger.info('Payment webhook: transaction already in terminal status, no-op (idempotent)', {
      provider: normalizedProvider,
      orderId: result.orderId,
      currentStatus: transaction.status,
      incomingStatus: result.status,
    });
    return transaction; // idempotent no-op — TIDAK reprocess, TIDAK perpanjang expiresAt lagi
  }

  const updatedTransaction = await prisma.membershipTransaction.update({
    where: { id: transaction.id },
    data: {
      status: result.status,
      paymentMethod: result.method,
      gatewayRawPayload: result.raw,
      paidAt: result.status === 'PAID' ? new Date() : transaction.paidAt,
    },
  });

  if (result.status === 'PAID') {
    const expiresAt = new Date(Date.now() + transaction.plan.durationDays * 24 * 60 * 60 * 1000);
    await prisma.membership.update({
      where: { id: transaction.membershipId },
      data: { status: 'ACTIVE', activatedAt: new Date(), expiresAt },
    });
    logger.info('Membership activated via payment', {
      profileId: transaction.membership.profileId,
      orderId: result.orderId,
      provider: normalizedProvider,
    });

    // In-app notification
    try {
      await prisma.notification.create({
        data: {
          profileId: transaction.membership.profileId,
          type: 'MEMBERSHIP_ACTIVATED',
          title: 'Membership Aktif!',
          message: `Selamat, paket ${transaction.plan.name} Anda telah aktif hingga ${expiresAt.toLocaleDateString('id-ID')}.`,
          data: {
            transactionId: transaction.id,
            planId: transaction.planId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    } catch (notifErr) {
      logger.error('Failed to create in-app notification for membership', { error: notifErr.message });
    }

    // Email notification
    const recipientEmail = transaction.membership?.profile?.user?.email;
    if (recipientEmail) {
      try {
        const { sendEmail } = require('../../utils/mailer');
        await sendEmail({
          to: recipientEmail,
          subject: 'Pembayaran Berhasil - Membership Sinaptex Aktif',
          text: `Halo ${transaction.membership.profile.fullName || 'Pengguna'},\n\nPembayaran untuk paket membership ${transaction.plan.name} berhasil diverifikasi. Status membership Anda sekarang AKTIF hingga ${expiresAt.toLocaleDateString('id-ID')}.\n\nNomor Invoice: ${transaction.invoiceNumber}\nJumlah: Rp ${transaction.amount.toLocaleString('id-ID')}\n\nTerima kasih telah bergabung bersama Sinaptex!`,
        });
      } catch (mailErr) {
        logger.error('Failed to send activation email', { error: mailErr.message });
      }
    }
  }

  return updatedTransaction;
}

async function listMyTransactions(profileId) {
  const membership = await prisma.membership.findUnique({ where: { profileId } });
  if (!membership) return [];
  return prisma.membershipTransaction.findMany({
    where: { membershipId: membership.id },
    include: { plan: true, pricing: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * STUB DEV — aktivasi manual TANPA lewat payment gateway. Dibatasi non-production
 * di controller. Dipakai untuk testing Chat/gating tanpa perlu kredensial payment
 * gateway sungguhan. GANTI/HAPUS begitu ada payment gateway real di environment testing.
 */
async function devActivate({ profileId, durationDays = 30 }) {
  const membership = await getOrCreateMembership(profileId);
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  return prisma.membership.update({
    where: { id: membership.id },
    data: { status: 'ACTIVE', activatedAt: new Date(), expiresAt },
  });
}

const { expireMembershipsAndTransitionTier } = require('./expireMemberships.service');

module.exports = {
  getOrCreateMembership,
  getActiveMembership,
  hasActiveMembership,
  listPlans,
  checkout,
  handlePaymentWebhook,
  listMyTransactions,
  devActivate,
  expireMembershipsAndTransitionTier,
  processExpiredMemberships: expireMembershipsAndTransitionTier,
};
