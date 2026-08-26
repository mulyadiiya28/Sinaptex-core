module.exports = {
  defaultProvider: 'MIDTRANS', // ganti ke provider lain begitu ada adapter baru terdaftar

  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    snapBaseUrl:
      process.env.MIDTRANS_IS_PRODUCTION === 'true'
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
  },

  // xendit: { ... }, duitku: { ... }, stripe: { ... } — tambahkan di sini saat
  // adapter provider tsb dibuat di src/core/payment/, ikuti pola `midtrans` di atas.

  orderIdPrefix: 'BMB-MEMBERSHIP-',
};
