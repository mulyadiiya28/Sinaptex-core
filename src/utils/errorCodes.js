/**
 * Kode error terpusat — frontend switch berdasarkan `code`, bukan parse
 * `message` (yang bisa berubah kapan saja / berbahasa Indonesia). Tambahkan
 * kode baru di sini dulu sebelum dipakai di ApiError, supaya semua kode yang
 * beredar selalu terdaftar & bisa diaudit dari satu tempat.
 */
module.exports = {
  // Generic (mengikuti HTTP status, dipakai kalau tidak ada kode domain yang lebih spesifik)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',

  // Membership / Pricing / Payment
  MEMBERSHIP_REQUIRED: 'MEMBERSHIP_REQUIRED',
  MEMBERSHIP_EXPIRED: 'MEMBERSHIP_EXPIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
  VOUCHER_NOT_SUPPORTED: 'VOUCHER_NOT_SUPPORTED',
  WEBHOOK_INVALID_SIGNATURE: 'WEBHOOK_INVALID_SIGNATURE',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',

  // Opportunity / Offer (FR-15)
  OFFER_QUOTA_EXCEEDED: 'OFFER_QUOTA_EXCEEDED',

  // Chat
  SELF_CONVERSATION: 'SELF_CONVERSATION',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  NOT_CONVERSATION_PARTICIPANT: 'NOT_CONVERSATION_PARTICIPANT',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',

  // Matching / Fraud (dibekukan, tapi kode tetap didaftarkan karena endpoint masih aktif)
  SELF_MATCH: 'SELF_MATCH',
  FRAUD_DETECTED: 'FRAUD_DETECTED',

  // Verification
  NOT_VERIFIED: 'NOT_VERIFIED',

  // Admin / Account moderation (MVP Phase 12)
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
};
