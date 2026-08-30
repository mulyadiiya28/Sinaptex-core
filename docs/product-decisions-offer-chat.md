# Keputusan produk — Offer, Membership, Chat (2026-08-30)

Dokumen ini adalah **sumber kebenaran** untuk revisi yang belum di kode.
Detail FR ada di `functional-requirement.md` (FR-15, FR-16, FR-17).
State machine: `state-machines.md`. Alur: `flowchart.md`.

## 1. Offer + membership

| Aturan | Keputusan |
|--------|-----------|
| Buat Offer | Wajib membership **ACTIVE** (tetap) |
| Buat Need | Gratis, tanpa membership (tetap) |
| Kuota Offer ACTIVE | **Max 20** per Profile (lintas semua Party milik profile) |
| Membership EXPIRED | Offer ACTIVE → keep **1 terbaru** (`createdAt` desc), sisanya **CLOSED** |
| Manfaat membership | Kuota Offer, prioritas matching/badge, limit chat longgar — **bukan** kunci mutlak chat Opportunity |

**Kode yang harus diubah nanti:**
- `src/modules/opportunity/opportunity.controller.js` — enforce kuota 20
- `src/jobs/expireMemberships.job.js` — side-effect trim Offer

## 2. Chat (revisi policy)

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
- Rate limit helper (baru) + enforce di `chat.service` / controller

## 3. Invitation vs Chat

- **Invitation** = jalur formal → Accept → Deal
- **Chat dari Opportunity** = jalur cepat, **tidak** wajib lewat Accept invitation
- User boleh pakai salah satu atau keduanya

## 4. Status implementasi

| Item | Docs | Kode |
|------|------|------|
| Offer butuh membership | ✅ | ✅ |
| Kuota 20 Offer | ✅ FR-15 | ⬜ |
| Trim Offer saat expire | ✅ FR-15 / state-machines | ⬜ |
| Chat Opportunity tanpa membership | ✅ FR-16 | ⬜ (masih gate membership di OFFER/PROFILE) |
| Rate limit chat | ✅ FR-16 | ⬜ |
| Invitation bukan syarat chat | ✅ FR-17 / flowchart | ⬜ (UX + policy) |

Setelah kode selesai, centang kolom Kode dan selaraskan FAQ seed (`prisma/seed.js`) yang masih menyebut chat butuh membership penerima.
