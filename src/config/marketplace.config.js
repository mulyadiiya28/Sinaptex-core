/**
 * Marketplace configuration (lean)
 * Ledger modules (cash/debt/receivable/inventory HPP) live in Business Suite — not here.
 */
module.exports = {
  product: {
    freeMaxProducts: Number(process.env.MP_FREE_MAX_PRODUCTS || 3),
    memberMaxProducts: Number(process.env.MP_MEMBER_MAX_PRODUCTS || 100),
    freeCanSell: process.env.MP_FREE_CAN_SELL === 'true',
    maxMediaPerProduct: Number(process.env.MP_MAX_MEDIA_PER_PRODUCT || 10),
    maxVariantsPerProduct: Number(process.env.MP_MAX_VARIANTS_PER_PRODUCT || 50),
    /** Simple stock alert on Product.stockQty — not inventory ledger */
    lowStockThreshold: Number(process.env.MP_LOW_STOCK_THRESHOLD || 5),
  },

  cart: {
    maxItems: Number(process.env.MP_CART_MAX_ITEMS || 50),
    maxQtyPerItem: Number(process.env.MP_CART_MAX_QTY || 99),
    ttlMinutes: Number(process.env.MP_CART_TTL_MINUTES || 60),
  },

  order: {
    maxAmount: Number(process.env.MP_ORDER_MAX_AMOUNT || 100_000_000),
    /** Soft-launch default: single-seller cart/checkout */
    allowMultiSeller: process.env.MP_ORDER_MULTI_SELLER === 'true',
    autoCreateBuyerParty: process.env.MP_AUTO_CREATE_BUYER_PARTY !== 'false',
    buyerPartyName: process.env.MP_BUYER_PARTY_NAME || 'Personal',
    invoicePrefix: process.env.MP_INVOICE_PREFIX || 'MKT',
  },

  review: {
    enabled: process.env.MP_REVIEW_ENABLED !== 'false',
    minRating: Number(process.env.MP_REVIEW_MIN_RATING || 1),
    maxRating: Number(process.env.MP_REVIEW_MAX_RATING || 5),
    allowAnonymous: process.env.MP_REVIEW_ANONYMOUS === 'true',
  },
};
