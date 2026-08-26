# Panduan Integrasi Frontend — Per Halaman

> **Untuk tim frontend.** Dokumen ini menjawab "di halaman X, API apa saja yang saya panggil,
> kapan, dan apa yang harus ditangani di UI" — disusun per HALAMAN, bukan per domain API
> (untuk referensi API lengkap per domain, lihat `docs/api-contract.md`).
>
> **Base URL:** `/api/v1` · **Auth:** `Authorization: Bearer <supabase_access_token>`
> **Format response & error code:** lihat `docs/api-contract.md` dan `docs/api/error-codes.md`
> **Realtime (Chat):** Socket.IO, lihat `docs/api/websocket.md`

## Daftar Isi
1. [Halaman Publik](#1-halaman-publik)
2. [Auth & Onboarding](#2-auth--onboarding)
3. [Profil & Party](#3-profil--party)
4. [Marketplace (Need/Offer)](#4-marketplace-needoffer)
5. [Matching & Invitation](#5-matching--invitation)
6. [Deal / Negosiasi](#6-deal--negosiasi)
7. [Chat](#7-chat)
8. [Membership & Pembayaran](#8-membership--pembayaran)
9. [Review & Reputasi](#9-review--reputasi)
10. [Notifikasi](#10-notifikasi)
11. [Lapor Pengguna](#11-lapor-pengguna)
12. [Admin Panel](#12-admin-panel)
13. [Referensi Cepat](#13-referensi-cepat)

---

## 1. Halaman Publik

### 1.1 Landing Page
**Auth:** Publik. **Tujuan:** halaman depan, tanpa perlu login.

| API | Kapan |
|---|---|
| `GET /content/pages/landing-page` *(kalau dibuat slug-nya)* | Konten hero/marketing yang di-manage admin, opsional |
| `GET /content/faq` | Kalau FAQ ditampilkan sebagian di landing |
| `GET /opportunities?limit=6&sortBy=createdAt` | Kalau mau tampilkan Opportunity terbaru sebagai preview |

**Catatan:** Branding (logo/warna) dan struktur visual landing page murni tanggung jawab
frontend — backend tidak menyediakan apa pun untuk itu.

### 1.2 Halaman Statis (Tentang Kami, Cara Kerja, Syarat & Ketentuan, Kebijakan Privasi, Kontak)
**Auth:** Publik.

| API | Kapan |
|---|---|
| `GET /content/pages/:slug` | Saat halaman dibuka. `slug` yang sudah di-seed: `tentang-kami`, `cara-kerja`, `syarat-ketentuan`, `kebijakan-privasi`, `kontak` |

**Kondisi penting:** kalau `404 NOT_FOUND`, artinya admin belum publish halaman itu (masih
`DRAFT`) — tampilkan pesan "halaman belum tersedia", bukan crash.

### 1.3 FAQ
**Auth:** Publik.

| API | Kapan |
|---|---|
| `GET /content/faq` | Saat halaman dibuka — hasil sudah terurut sesuai `order`, hanya yang `PUBLISHED` |

---

## 2. Auth & Onboarding

### 2.1 Register / Login
**Auth:** Login dilakukan LANGSUNG ke Supabase Auth (bukan ke backend ini) — pakai SDK
`@supabase/supabase-js` di frontend:
```js
// Email
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });
// Google
await supabase.auth.signInWithOAuth({ provider: 'google' });
// Lupa password
await supabase.auth.resetPasswordForEmail(email);
```
Setelah dapat session dari Supabase, **baru** panggil backend:

| API | Kapan |
|---|---|
| `POST /auth/register` | Sekali, tepat setelah sign-up/sign-in pertama kali. Idempotent — aman dipanggil ulang, akan mengembalikan profile yang sudah ada kalau sudah pernah register |
| `GET /auth/me` | Setiap kali app dibuka / restore session, buat hydrate state user |

**Body `POST /auth/register`** (lihat `docs/api-requests.md` §1 untuk contoh lengkap):
`fullName`, `phone?`, `bio?`, `location?`, `party?` (opsional buat sekalian bikin Party
pertama), `businessRoles[]`, `capabilityNames[]?`.

**Kondisi penting:** kalau backend belum kenal user ini (`401 Missing bearer token` di
endpoint lain sebelum `/auth/register` dipanggil), redirect ke alur registrasi, bukan
tampilkan error mentah.

### 2.2 Lengkapi Profil (Onboarding)
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `PATCH /profiles/me` | Simpan `fullName`, `bio`, `location` |
| `POST /parties` | Kalau user belum bikin Party saat register, atau mau tambah Party kedua (mis. Individual dulu, nanti tambah Company) |
| `POST /verification-documents` (multipart) | Upload KTP/NIB/NPWP — opsional di onboarding, bisa juga dilakukan nanti |

**Profile Progress (%):** belum ada endpoint hitung otomatis — hitung di frontend dari field
yang terisi (`fullName`, `avatarUrl`, `bio`, `location`, punya minimal 1 Party, dst).

---

## 3. Profil & Party

### 3.1 Profil Saya / Pengaturan Akun
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `GET /auth/me` | Load data awal |
| `PATCH /profiles/me` | Simpan perubahan |
| `GET /parties` | Tampilkan daftar Party milik user |
| `GET /membership/me` | Tampilkan status membership di halaman ini |
| `GET /reviews/profile/:profileId` (pakai `profile.id` sendiri) | Tab "Review yang saya terima" |

### 3.2 Kelola Party (bisa lebih dari satu)
**Auth:** Perlu login untuk create/update; detail Party publik.

| API | Kapan |
|---|---|
| `GET /parties` | List semua Party milik user |
| `POST /parties` | Buat Party baru |
| `PATCH /parties/:id` | Edit Party |
| `POST /parties/:id/capabilities`, `DELETE /parties/:id/capabilities/:capabilityId` | Kelola skill/bidang Party |
| `POST /verification-documents` (body `partyId`) | Upload dokumen verifikasi milik Party ini (bukan Profile) |

### 3.3 Halaman Profil Publik Orang Lain
**Auth:** Publik.

| API | Kapan |
|---|---|
| `GET /profiles/:id` | Data dasar profile |
| `GET /parties/:id` | Detail Party (kalau masuk dari halaman Opportunity) |
| `GET /reviews/profile/:id` | Tab Review — HANYA review yang `hidden: false` yang muncul |

---

## 4. Marketplace (Need/Offer)

### 4.1 Cari/Browse Opportunity
**Auth:** Publik (hasil bisa dipersonalisasi kalau login, tapi tidak wajib).

**Cara paling simpel — satu pintu:**

| API | Kapan |
|---|---|
| `POST /intent` `{ text: "<kalimat bebas user>" }` | Search bar utama — backend otomatis putuskan ini pencarian Opportunity langsung atau butuh diagnosis (lihat §5.3) |

**Cara terstruktur (filter manual di UI, mis. dropdown kategori/lokasi):**

| API | Kapan |
|---|---|
| `GET /opportunities?type=&categoryId=&location=&tag=&budgetMin=&budgetMax=&search=&sortBy=&sortOrder=&page=&limit=` | List dengan filter eksplisit |

> **Catatan:** `GET /opportunities` ditandai *deprecated* (header `Deprecation: true`) demi
> `/intent` sebagai pintu masuk utama — tapi tetap 100% berfungsi, cocok dipakai untuk UI
> filter terstruktur yang memang butuh kontrol penuh (bukan search bar bebas).

### 4.2 Detail Opportunity
**Auth:** Publik.

| API | Kapan |
|---|---|
| `GET /opportunities/:id` | Load detail |
| `GET /parties/:id` | Info pemilik (kalau butuh detail lebih dari yang sudah ter-include) |
| `POST /chat/conversations` `{ recipientProfileId, originType: "NEED"|"OFFER", opportunityId }` | Tombol "Chat" — lihat §7.1 untuk gating membership |

### 4.3 Buat/Edit Opportunity (Need/Offer)
**Auth:** Perlu login + punya Party.

| API | Kapan |
|---|---|
| `POST /opportunities` | Submit form buat baru |
| `PATCH /opportunities/:id` | Submit form edit |
| `POST /opportunities/:id/media` (multipart) | Upload foto/gambar produk |

**Kondisi penting — WAJIB ditangani UI:**
- Bikin **Offer** (`type: "OFFER"`) tanpa membership aktif -> `403 MEMBERSHIP_REQUIRED`.
  Tampilkan modal/redirect ke halaman Membership, JANGAN cuma tampilkan pesan error mentah.
- Bikin **Need** (`type: "NEED"`) selalu gratis, tidak ada gating.

### 4.4 Opportunity Saya (My Listings)
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `GET /opportunities?...` lalu filter di frontend berdasarkan `party.id` milik sendiri | *(belum ada endpoint `GET /opportunities/mine` khusus — catat sebagai potensi tambahan kalau UI butuh)* |

---

## 5. Matching & Invitation

### 5.1 Jalankan Matching dari Opportunity Saya
**Auth:** Perlu login + pemilik Opportunity.

| API | Kapan |
|---|---|
| `GET /matching/:opportunityId/run?limit=10` | Tombol "Cari yang cocok" di halaman Opportunity milik sendiri |

**Response penting:** setiap hasil punya `matchId`, `matchScore`, `finalScore`,
`matchBreakdown`, `rankingBreakdown` — tampilkan breakdown ini ke user (explainable result),
JANGAN cuma angka akhir. Simpan `matchId` untuk step berikutnya (kirim Invitation).

### 5.2 Kirim & Kelola Invitation
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `POST /invitations` `{ matchId, message? }` | Tombol "Kirim Undangan" dari hasil matching |
| `GET /invitations/me` | Halaman "Undangan Saya" (inbox + sent) |
| `PATCH /invitations/:id/respond` `{ action: "ACCEPT"|"REJECT" }` | Tombol accept/reject di inbox |

**Kondisi penting:** setelah `ACCEPT`, response berisi `contact` (info kontak pihak lain) dan
`deal` (Deal baru berstatus `NEGOTIATION`) — langsung arahkan user ke halaman Deal (§6).

### 5.3 Diagnosis Kebutuhan / Masalah Bisnis *(fitur lanjutan, via `/intent`)*
Kalau `POST /intent` mengklasifikasikan input sebagai `NEEDS_DIAGNOSIS`, response berisi
salah satu dari:
- `engine: "decision"` + `pendingQuestions[]` -> tampilkan sebagai form klarifikasi singkat,
  lanjutkan ke `POST /decision/inquiries/:id/answers`
- `engine: "business-diagnosis"` + `pendingFactors[]` -> form isi data (angka/boolean/kategori),
  lanjutkan ke `POST /business-diagnosis/sessions/:id/factors`
- `alert` tanpa engine spesifik -> tampilkan pesan jujur "belum yakin", beri pilihan manual
  (`options[]` di response)

> Fitur ini (Decision/Diagnosis Engine) **dibekukan** — endpoint tetap aktif dan bisa
> diintegrasikan, tapi bukan prioritas pengembangan backend saat ini.

---

## 6. Deal / Negosiasi

**Auth:** Perlu login + jadi salah satu pihak di Deal.

| API | Kapan |
|---|---|
| `GET /invitations/deals/me` | Halaman "Deal Saya" (list semua) |
| `PATCH /invitations/deals/:id` `{ status, agreedTerms?, notes?, cancelReason? }` | Update status: `NEGOTIATION -> DEAL -> IN_PROGRESS -> COMPLETED`, atau `CANCELLED` |

**State machine yang harus di-render UI** (lihat `docs/state-machines.md` untuk diagram
lengkap): tombol aksi yang tersedia beda-beda tergantung status saat ini — jangan tampilkan
tombol "Selesaikan" kalau status masih `NEGOTIATION`, dst.

**Kondisi penting — WAJIB ditangani UI:**
- Transisi ke `COMPLETED` bisa ditolak `409 FRAUD_DETECTED` (Fraud Detection Engine,
  dibekukan tapi tetap aktif memeriksa). Tampilkan pesan "sedang ditinjau admin", jangan
  biarkan user retry berkali-kali.
- Setelah `COMPLETED`, tampilkan CTA "Beri Review" (§9).

---

## 7. Chat

### 7.1 Mulai Percakapan Baru
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `POST /chat/conversations` `{ recipientProfileId, originType, opportunityId? }` | Tombol "Chat" di halaman Opportunity/Profile |

**`originType` — WAJIB dikirim benar, ini menentukan aturan bisnis:**

| originType | Kapan dipakai | Gating |
|---|---|---|
| `"NEED"` | User (sebagai provider) meng-klik Chat dari Opportunity ber-`type: NEED` milik orang lain | **Gratis**, tidak ada gating |
| `"OFFER"` | User (sebagai buyer) meng-klik Chat dari Opportunity ber-`type: OFFER` milik orang lain | Recipient (pemilik Offer) **wajib membership aktif** |
| `"PROFILE"` | Chat langsung dari halaman Profil, bukan dari Opportunity | Recipient **wajib membership aktif** |

**Kondisi penting:** kalau `403 MEMBERSHIP_REQUIRED`, itu artinya PENERIMA (bukan pengirim)
belum member aktif — tampilkan pesan yang jelas ("penyedia jasa ini belum aktif, coba lagi
nanti" atau serupa), JANGAN arahkan pengirim ke halaman Membership (dia bukan yang perlu bayar).

### 7.2 List Percakapan
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `GET /chat/conversations` | Load daftar percakapan, sudah termasuk `lastMessage` dan `hasUnread` |

### 7.3 Jendela Chat
**Auth:** Perlu login + partisipan.

| API/Event | Kapan |
|---|---|
| `GET /chat/conversations/:id/messages?page=&limit=` | Load riwayat pesan saat buka percakapan |
| WS `message:send` | Kirim pesan teks (real-time, lihat `docs/api/websocket.md`) |
| `POST /chat/conversations/:id/messages` (multipart) | Kirim gambar/attachment (tidak bisa lewat WS) |
| WS `typing:start`/`typing:stop` | Indikator mengetik |
| WS `conversation:read` atau `PATCH /chat/conversations/:id/read` | Tandai sudah dibaca (saat window chat dibuka/scroll ke bawah) |

**WAJIB baca `docs/api/websocket.md` secara utuh** sebelum implementasi — ada detail penting
soal reconnect (pesan yang lewat saat disconnect TIDAK di-replay otomatis, harus fetch ulang).

---

## 8. Membership & Pembayaran

### 8.1 Halaman Pilih Paket
**Auth:** Publik (checkout perlu login).

| API | Kapan |
|---|---|
| `GET /membership/plans` | List paket + harga aktif (`currentPrice`) |
| `GET /membership/me` | Kalau login, tampilkan status membership saat ini di halaman yang sama |

### 8.2 Checkout
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `POST /membership/checkout` `{ planId }` + header `Idempotency-Key: <uuid>` | Tombol "Bayar" |

**WAJIB kirim header `Idempotency-Key`** (UUID v4 random per klik, bukan per session) —
mencegah dobel tagihan kalau user klik dua kali/koneksi lambat. Response berisi `paymentUrl`
(Midtrans Snap) — redirect user ke sana.

**Setelah pembayaran:** Midtrans redirect balik ke URL yang dikonfigurasi di dashboard
Midtrans (bukan API ini) — pastikan halaman redirect itu **polling** `GET /membership/me`
beberapa detik sekali sampai `status: "ACTIVE"` (webhook dari Midtrans ke backend butuh
waktu, tidak instan).

### 8.3 Riwayat Transaksi / Invoice
**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `GET /membership/transactions/me` | Halaman riwayat pembayaran |

---

## 9. Review & Reputasi

### 9.1 Beri Review (setelah Deal selesai)
**Auth:** Perlu login + pihak di Deal yang `COMPLETED`.

| API | Kapan |
|---|---|
| `POST /reviews/deals/:dealId` `{ revieweeId, rating, comment? }` | Form review setelah Deal `COMPLETED` |

### 9.2 Lihat Review Seseorang
**Auth:** Publik.

| API | Kapan |
|---|---|
| `GET /reviews/profile/:profileId` | Tab Review di halaman Profil (§3.3) |

---

## 10. Notifikasi

**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `GET /notifications/me` | Dropdown/halaman notifikasi, polling berkala ATAU trigger setelah event WS relevan (mis. `message:new`) |
| `PATCH /notifications/:id/read` | Klik notifikasi |

**Catatan:** notifikasi in-app saat ini HANYA untuk event Chat (`type: "CHAT_MESSAGE"`) dan
event Invitation/Deal lama (Phase 07). Belum ada channel Email/WhatsApp — kalau UI perlu
menunjukkan preferensi notifikasi channel lain, itu belum ada backing API-nya.

---

## 11. Lapor Pengguna

**Auth:** Perlu login.

| API | Kapan |
|---|---|
| `POST /reports` `{ reportedId, reason, description? }` | Tombol "Laporkan" di halaman Profil/Chat |
| `GET /reports` | Halaman "Laporan Saya" (opsional, lihat status ditinjau/tidak) |

`reason` harus salah satu dari: `SPAM`, `PENIPUAN`, `KONTEN_TIDAK_PANTAS`, `PELECEHAN`, `LAINNYA`.

---

## 12. Admin Panel

> Semua endpoint di bawah butuh `BusinessRole: ADMIN` — beda aplikasi/route group dari app
> user biasa (disarankan build sebagai app terpisah atau route ter-guard khusus di frontend).

### 12.1 Dashboard
| API | Kapan |
|---|---|
| `GET /admin/dashboard` | Load angka ringkas (users, opportunities, deals, revenue, pending items) |

### 12.2 Kelola User
| API | Kapan |
|---|---|
| `GET /admin/users?search=&accountStatus=&page=&limit=` | List + cari |
| `GET /admin/users/:id` | Detail |
| `PATCH /admin/users/:id/status` `{ accountStatus, reason? }` | Suspend/ban/pulihkan — `reason` wajib kalau bukan `ACTIVE` |

### 12.3 Moderasi Opportunity
| API | Kapan |
|---|---|
| `GET /admin/opportunities?status=&page=&limit=` | List semua (termasuk non-public) |
| `PATCH /admin/opportunities/:id/status` `{ status, moderationNote? }` | Paksa ubah status |

### 12.4 Moderasi Review
| API | Kapan |
|---|---|
| `GET /admin/reviews?hidden=&page=&limit=` | List |
| `PATCH /admin/reviews/:id/visibility` `{ hidden, hiddenReason? }` | Sembunyikan/tampilkan — `hiddenReason` wajib kalau `hidden: true` |

### 12.5 Laporan User
| API | Kapan |
|---|---|
| `GET /admin/reports?status=&page=&limit=` | List |
| `PATCH /admin/reports/:id` `{ status, adminNote? }` | Tinjau — `status`: `REVIEWED`/`DISMISSED`/`ACTION_TAKEN` |

### 12.6 Transaksi (lintas semua user)
| API | Kapan |
|---|---|
| `GET /admin/transactions?status=&page=&limit=` | Halaman laporan pembayaran |

### 12.7 Kelola Konten (CMS)
| API | Kapan |
|---|---|
| `GET /admin/content/pages` | List semua halaman statis (semua status) |
| `PUT /admin/content/pages/:slug` `{ title, content, status }` | Editor halaman (upsert — slug tetap, konten diganti) |
| `GET/POST/PATCH/DELETE /admin/content/faq*` | CRUD FAQ |

### 12.8 (Dibekukan, tapi tetap aktif) Fraud, Decision, Business Diagnosis
Endpoint `/admin`-adjacent untuk fitur ini (`/fraud-flags`, `/decision/knowledge`,
`/business-diagnosis/knowledge`, `/business-diagnosis/advisory/:id/publish`) tetap
berfungsi kalau frontend admin ingin diintegrasikan lebih awal — tapi ini BUKAN prioritas
MVP, boleh ditunda ke fase berikutnya.

---

## 13. Referensi Cepat

- **Semua response sukses:** `{ success: true, message, data, meta? }`
- **Semua response error:** `{ success: false, code, message, details? }` — switch UI
  berdasarkan `code`, bukan `message` (lihat `docs/api/error-codes.md` untuk daftar lengkap)
- **Pagination standar:** `?page=1&limit=20`, response `meta: { page, limit, total, totalPages }`
- **Idempotency:** endpoint pembayaran (`POST /membership/checkout`) WAJIB kirim header
  `Idempotency-Key`
- **State machine referensi:** `docs/state-machines.md` (Opportunity, Invitation, Deal,
  Membership, MembershipTransaction, VerificationDocument)
- **Permission per-endpoint:** `docs/api/permission-matrix.md`
- **Endpoint deprecated tapi tetap jalan** (ditandai header `Deprecation: true`): `GET /opportunities`
  (pakai `/intent` untuk search bar bebas), `POST /decision/inquiries`, `POST /business-diagnosis/sessions`
