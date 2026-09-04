const crypto = require('crypto');
const paymentConfig = require('../../config/payment.config');
const PaymentStatus = require('./PaymentStatus');
const logger = require('../logger');

/**
 * MIDTRANS ADAPTER — implementasi konkret PaymentGateway untuk Midtrans Snap.
 * SEMUA istilah/detail spesifik Midtrans (capture/settlement/deny, payment_type,
 * signature SHA-512, dst) hidup di sini SAJA. Modul lain (membership.service.js)
 * hanya bicara lewat method generik di bawah — tidak pernah tahu kata "Midtrans"
 * atau "Snap" sama sekali.
 */

const config = paymentConfig.midtrans;

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;
}

/** Midtrans payment_type -> PaymentMethod internal (enum Prisma). */
const PAYMENT_TYPE_MAP = {
  qris: 'QRIS',
  gopay: 'EWALLET',
  shopeepay: 'EWALLET',
  credit_card: 'CREDIT_CARD',
  bank_transfer: 'VA',
  echannel: 'VA', // Mandiri Bill Payment, secara UX mirip VA
  permata_va: 'VA',
  bca_va: 'VA',
  cstore: 'BANK_TRANSFER', // Indomaret/Alfamart over-the-counter
};

function mapPaymentMethod(paymentType) {
  return PAYMENT_TYPE_MAP[paymentType] || null;
}

/** capture/settlement/deny/cancel/expire/pending -> PaymentStatus internal. */
function mapTransactionStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'capture') {
    // challenge = menunggu review fraud Midtrans; treat as still pending
    if (fraudStatus === 'challenge') return PaymentStatus.PENDING;
    return fraudStatus === 'accept' ? PaymentStatus.PAID : PaymentStatus.FAILED;
  }
  if (transactionStatus === 'settlement') return PaymentStatus.PAID;
  if (['deny', 'cancel', 'failure'].includes(transactionStatus)) return PaymentStatus.FAILED;
  if (transactionStatus === 'expire') return PaymentStatus.EXPIRED;
  if (transactionStatus === 'pending') return PaymentStatus.PENDING;
  return PaymentStatus.FAILED;
}

/**
 * @param {object} params
 * @param {string} params.orderId
 * @param {number} params.grossAmount - Rupiah, bilangan bulat
 * @param {{ name: string, email?: string, phone?: string }} params.customer
 * @param {string} params.itemName
 * @returns {Promise<{provider: string, transactionId: string, paymentUrl: string, token: string, expiredAt: Date|null, raw: object}>}
 */
async function createTransaction({ orderId, grossAmount, customer, itemName }) {
  if (!config.serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY belum diset — tidak bisa membuat transaksi pembayaran.');
  }

  const body = {
    transaction_details: { order_id: orderId, gross_amount: Math.round(grossAmount) },
    customer_details: { first_name: customer.name, email: customer.email, phone: customer.phone },
    item_details: [{ id: orderId, price: Math.round(grossAmount), quantity: 1, name: itemName }],
  };

  const response = await fetch(config.snapBaseUrl, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logger.error('Midtrans createTransaction failed', { status: response.status, errorText });
    throw new Error(`Payment gateway error (${response.status}): gagal membuat transaksi.`);
  }

  const data = await response.json();
  return {
    provider: 'MIDTRANS',
    transactionId: orderId,
    paymentUrl: data.redirect_url,
    token: data.token,
    expiredAt: null,
    raw: data,
  };
}

/**
 * @param {object} payload - body notifikasi webhook mentah dari Midtrans
 * @returns {{valid: boolean, orderId: string, status: string|null, method: string|null, grossAmount: number|null, raw: object}}
 */
function verifyWebhook(payload) {
  const {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
    transaction_status: transactionStatus,
    fraud_status: fraudStatus,
    payment_type: paymentType,
  } = payload || {};

  if (!config.serverKey) {
    return { valid: false, orderId, status: null, method: null, grossAmount: null, raw: payload };
  }

  const expectedSignature = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${config.serverKey}`)
    .digest('hex');

  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
  const valid = safeEqual(expectedSignature, String(signatureKey || ''));
  if (!valid) {
    return { valid: false, orderId, status: null, method: null, grossAmount: null, raw: payload };
  }

  const parsedAmount =
    grossAmount === undefined || grossAmount === null || grossAmount === ''
      ? null
      : Number(grossAmount);

  return {
    valid: true,
    orderId,
    status: mapTransactionStatus(transactionStatus, fraudStatus),
    method: mapPaymentMethod(paymentType),
    grossAmount: Number.isFinite(parsedAmount) ? parsedAmount : null,
    raw: payload,
  };
}

module.exports = { createTransaction, verifyWebhook, config };
