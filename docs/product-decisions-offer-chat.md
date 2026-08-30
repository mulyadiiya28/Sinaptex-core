# Keputusan produk — Offer, Membership, Chat (2026-08-30)

Dokumen ini adalah **sumber kebenaran** untuk revisi produk Offer/Membership/Chat.
Detail FR: `functional-requirement.md` (FR-15, FR-16, FR-17).
State machine: `state-machines.md`. Alur: `flowchart.md`.

## 1. Offer + membership

| Aturan | Keputusan | Kode |
|--------|-----------|------|
| Buat Offer | Wajib membership **ACTIVE** | ✅ `createOpportunity` |
| Buat Need | Gratis, tanpa membership | ✅ |
| Kuota Offer ACTIVE | **Max 20** per Profile (lintas Party) | ✅ `MAX_ACTIVE_OFFERS` + `assertOfferQuota` |
| Re-aktifkan Offer (PATCH status ACTIVE) | Membership + kuota | ✅ `updateOpportunity` |
| Membership EXPIRED | Keep **1** Offer terbaru ACTIVE, sisanya **CLOSED** | ✅ `expireMemberships.job.js` |
| Error kuota | `OFFER_QUOTA_EXCEEDED` (403) | ✅ `errorCodes.js` |

Konstanta: `src/shared/constants.js` → `MAX_ACTIVE_OFFERS`, `OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE`.

## 2. Chat (revisi policy) — belum di kode

| originType | Aturan baru |
|------------|-------------|
| NEED / OFFER (+ opportunityId valid) | Chat **tanpa** membership; anti-spam rate limit |
| PROFILE (cold DM) | Ketat: member recipient **atau** verified **atau** rate limit sangat ketat |
| Conversation existing | Reply selalu boleh |

**Anti-spam (default angka):**
- Non-member: max **5** conversation baru / profile / hari
- Member aktif: max **30** conversation baru / hari
- Max **20** pesan / jam ke lawan yang belum membalas
- Block + report tetap dipakai

**Kode yang harus diubah nanti:**
- `src/modules/chat/chat.policy.js`
- Rate limit helper + enforce di chat service/controller

## 3. Invitation vs Chat

- **Invitation** = jalur formal → Accept → Deal
- **Chat dari Opportunity** = jalur cepat, **tidak** wajib lewat Accept invitation
- User boleh pakai salah satu atau keduanya

## 4. Status implementasi

| Item | Docs | Kode |
|------|------|------|
| Offer butuh membership | ✅ | ✅ |
| Kuota 20 Offer | ✅ FR-15 | ✅ |
| Trim Offer saat expire | ✅ FR-15 | ✅ |
| Chat Opportunity tanpa membership | ✅ FR-16 | ⬜ |
| Rate limit chat | ✅ FR-16 | ⬜ |
| Invitation bukan syarat chat | ✅ FR-17 | ⬜ (UX + policy) |

Pastikan proses **scheduler** (`npm run scheduler`) jalan di production agar
`expireMemberships` + trim Offer dieksekusi harian.
