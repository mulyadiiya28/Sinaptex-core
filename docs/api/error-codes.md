# Error Codes

Setiap error response punya field `code` (machine-readable) selain `message` (human-readable,
bisa berubah/berbahasa Indonesia). **Frontend sebaiknya switch berdasarkan `code`, bukan
parse `message`.**

Sumber tunggal kebenaran: [`src/utils/errorCodes.js`](../../src/utils/errorCodes.js).

```json
{
  "success": false,
  "code": "MEMBERSHIP_REQUIRED",
  "message": "Tidak bisa memulai percakapan baru: penerima belum memiliki membership aktif.",
  "details": null
}
```

## Generic (mengikuti HTTP status)

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query/params tidak lolos validasi Zod |
| `UNAUTHORIZED` | 401 | Token tidak ada / invalid / expired |
| `PAYMENT_REQUIRED` | 402 | *(disiapkan, belum ada endpoint yang pakai — lihat `MEMBERSHIP_REQUIRED` untuk kasus serupa saat ini)* |
| `FORBIDDEN` | 403 | Tidak punya akses ke resource ini |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `CONFLICT` | 409 | State transition tidak valid / duplikasi |
| `INTERNAL_ERROR` | 500 | Kesalahan server tak terduga |

## Membership / Pricing / Payment

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `MEMBERSHIP_REQUIRED` | 403 | Chat baru (originType OFFER/PROFILE) ke recipient tanpa membership aktif |
| `MEMBERSHIP_EXPIRED` | — | *(disiapkan untuk Phase 6 Offer gating, belum dipakai)* |
| `PAYMENT_FAILED` | 500 | Payment gateway gagal dipanggil saat checkout |
| `PLAN_NOT_FOUND` | 404 | `planId` tidak ada di `MembershipPlan` |
| `PRICING_NOT_FOUND` | 404 | Plan tidak punya `MembershipPricing` yang `ACTIVE` |
| `VOUCHER_NOT_SUPPORTED` | 400 | `voucherCode` diisi tapi fitur voucher belum diimplementasikan |
| `WEBHOOK_INVALID_SIGNATURE` | 403 | Signature webhook payment gateway tidak valid |
| `TRANSACTION_NOT_FOUND` | 404 | `order_id` di webhook tidak cocok transaksi manapun |
| `IDEMPOTENCY_KEY_REUSED` | — | *(disiapkan; saat ini replay idempotency mengembalikan 201 dengan transaksi lama, bukan error — lihat `conventions.md`)* |

## Chat

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `SELF_CONVERSATION` | 403 | Mencoba memulai percakapan dengan diri sendiri |
| `CONVERSATION_NOT_FOUND` | 404 | `conversationId` tidak ditemukan |
| `NOT_CONVERSATION_PARTICIPANT` | 403 | Bukan partisipan percakapan ini |
| `EMPTY_MESSAGE` | 400 | Kirim pesan TEXT tanpa isi |

## Matching / Fraud *(dibekukan, endpoint tetap aktif)*

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `SELF_MATCH` | — | *(disiapkan; saat ini self-match dicegah dengan exclude di query, bukan error eksplisit)* |
| `FRAUD_DETECTED` | 409 | `PATCH /invitations/deals/:id` ke COMPLETED diblokir Fraud Detection Engine |

## Verification

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `NOT_VERIFIED` | — | *(disiapkan untuk gating masa depan yang mensyaratkan Party terverifikasi)* |

## Admin / Account Moderation (MVP Phase 12)

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `ACCOUNT_SUSPENDED` | 403 | Login dengan akun berstatus `SUSPENDED` — ditolak di `requireAuth`, sebelum masuk controller mana pun |
| `ACCOUNT_BANNED` | 403 | Login dengan akun berstatus `BANNED` |

## Rate Limiting

| Code | HTTP Status | Kapan muncul |
|---|---|---|
| `RATE_LIMITED` | 429 | *(disiapkan; saat ini `express-rate-limit` mengembalikan response bawaannya sendiri tanpa field `code` — lihat catatan di `conventions.md`)* |

## Menambah Kode Baru

1. Daftarkan dulu di `src/utils/errorCodes.js`
2. Pakai lewat parameter `code` di `ApiError` (mis. `ApiError.forbidden(message, ErrorCodes.MEMBERSHIP_REQUIRED)`)
3. Update tabel di dokumen ini
