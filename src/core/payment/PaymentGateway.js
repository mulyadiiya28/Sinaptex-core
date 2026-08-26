const paymentConfig = require('../../config/payment.config');
const MidtransGateway = require('./MidtransGateway');

/**
 * FACTORY — modul lain (membership.service.js, nanti pricing produk lain)
 * memanggil `PaymentGateway.getDefault()` atau `PaymentGateway.of('MIDTRANS')`,
 * TIDAK PERNAH mengimpor MidtransGateway/XenditGateway secara langsung. Ini
 * yang membuat ganti/nambah provider tidak menyentuh kode Membership sama sekali.
 *
 * Setiap adapter WAJIB mengimplementasikan interface yang sama:
 *   createTransaction({ orderId, grossAmount, customer, itemName }) -> PaymentResult
 *   verifyWebhook(payload) -> WebhookResult
 */

const registry = {
  MIDTRANS: MidtransGateway,
  // XENDIT: require('./XenditGateway'),   // daftarkan di sini saat adapter dibuat
  // DUITKU: require('./DuitkuGateway'),
  // STRIPE: require('./StripeGateway'),
};

function of(provider) {
  const gateway = registry[provider];
  if (!gateway) {
    throw new Error(`Payment provider "${provider}" belum punya adapter terdaftar di PaymentGateway.js`);
  }
  return gateway;
}

function getDefault() {
  return of(paymentConfig.defaultProvider);
}

module.exports = { of, getDefault };
