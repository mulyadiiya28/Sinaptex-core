# API Contract (Ringkasan)

> **Ini adalah INDEX.** Untuk detail lintas-domain, lihat dokumen khusus di `docs/api/`:
> - [`docs/api/conventions.md`](api/conventions.md) — pagination, filtering, idempotency, versioning/deprecation, rate limit
> - [`docs/api/error-codes.md`](api/error-codes.md) — daftar lengkap `code` di error response
> - [`docs/api/websocket.md`](api/websocket.md) — kontrak Socket.IO (Chat) secara detail
> - [`docs/api/permission-matrix.md`](api/permission-matrix.md) — endpoint x role (Guest/User/Admin)
> - [`docs/state-machines.md`](state-machines.md) — diagram formal semua entitas berstatus (Deal, Invitation, Membership, dst)

> **Catatan pivot:** endpoint `/fraud-flags`, `/decision`, `/business-diagnosis`, `/intent`
> di tabel bawah tetap aktif tapi statusnya DIBEKUKAN (bukan fokus pengembangan saat ini) —
> lihat catatan pivot di `docs/PROJECT_CHECKLIST.md`. Fokus saat ini: MVP checklist v1.0.
>
> **Chat pakai WebSocket (Socket.IO), bukan REST murni** — lihat `docs/api/websocket.md`.
> Endpoint `/chat/*` di bawah adalah REST pelengkap (manajemen conversation, riwayat, upload gambar).

> Untuk kontrak formal, rencana Phase 12: generate OpenAPI spec via `swagger-jsdoc` dan
> serve di `/api/docs` (belum diimplementasi — lihat `PROJECT_CHECKLIST.md`).

## Konvensi Umum

**Base URL:** `/api/v1` (alias tanpa versi `/api` masih aktif untuk kompatibilitas — lihat
kebijakan versioning/deprecation lengkap di `docs/api/conventions.md`)
**Auth:** header `Authorization: Bearer <supabase_access_token>` (kecuali endpoint publik)
**Swagger UI:** `/api/docs` — JSDoc `@openapi` per-endpoint sudah lengkap (semua path
& method di-cover) untuk: Auth, Profiles, Admin, Escrow, Verification, Notifications,
Reviews (deal), Invitations, Chat, Opportunities, Content. Modul lain (Boost, Business
Diagnosis, Decision, Fraud, Intent, Matching, Membership, Party, Pricing, Report) sudah
punya sebagian `@openapi` dari sebelumnya — belum diverifikasi lengkap per-endpoint.
Marketplace & Business Suite belum di-annotate `@openapi` sama sekali (hanya kontrak
ringkas di tabel bawah) — lengkapi bertahap.

### Response Sukses
```json
{
  "success": true,
  "message": "OK",
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### Response Error
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [{ "path": "title", "message": "String must contain at least 3 character(s)" }]
}
```
Lihat [`docs/api/error-codes.md`](api/error-codes.md) untuk daftar lengkap `code` yang mungkin muncul.

## Daftar Endpoint

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/auth/register` | Bearer (Supabase) | Sinkron user Supabase → Profile lokal |
| GET | `/auth/me` | Bearer | Ambil profile yang login |
| GET | `/profiles/:id` | Bearer | Detail profile + party + capability |
| PATCH | `/profiles/me` | Bearer | Update profile sendiri |
| POST | `/parties` | Bearer | Buat Party baru (Profile bisa punya lebih dari satu) |
| GET | `/parties` | Bearer | List Party milik sendiri |
| GET | `/parties/:id` | Publik | Detail Party |
| PATCH | `/parties/:id` | Bearer | Update Party milik sendiri |
| POST | `/parties/:id/capabilities` | Bearer | Tambah Capability ke Party |
| DELETE | `/parties/:id/capabilities/:capabilityId` | Bearer | Hapus Capability dari Party |
| POST | `/verification-documents` | Bearer | Upload dokumen verifikasi (multipart `file`) |
| GET | `/verification-documents/me` | Bearer | List dokumen milik sendiri |
| PATCH | `/verification-documents/:id/review` | Bearer + role ADMIN | Approve/reject dokumen |
| POST | `/opportunities` | Bearer | Buat Opportunity (Need/Offer) |
| GET | `/opportunities` | Publik | List Opportunity — filter: `type`, `categoryId`, `status`, `location`, `tag`, `budgetMin`, `budgetMax`, `search`; sort: `sortBy`(`createdAt`\|`budgetMin`\|`budgetMax`\|`priority`), `sortOrder`(`asc`\|`desc`) |
| GET | `/opportunities/:id` | Publik | Detail Opportunity |
| PATCH | `/opportunities/:id` | Bearer (owner) | Update Opportunity |
| POST | `/opportunities/:id/media` | Bearer (owner) | Upload media Opportunity |
| GET | `/boosts/plans` | Publik | List paket boost |
| POST | `/boosts/:opportunityId/activate` | Bearer (owner) | Aktivasi boost |
| GET | `/matching/:opportunityId/run` | Bearer | Jalankan matching + ranking engine |
| POST | `/invitations` | Bearer | Kirim invitation dari sebuah Match |
| GET | `/invitations/me` | Bearer | List invitation milik party sendiri |
| PATCH | `/invitations/:id/respond` | Bearer (penerima) | Accept/Reject invitation |
| GET | `/invitations/deals/me` | Bearer | List deal milik sendiri |
| PATCH | `/invitations/deals/:id` | Bearer (pihak terkait) | Update status Deal |
| POST | `/reviews/deals/:dealId` | Bearer (pihak terkait) | Beri review pasca-deal |
| GET | `/reviews/profile/:profileId` | Publik | List review milik seorang profile |
| GET | `/notifications/me` | Bearer | List notifikasi sendiri |
| PATCH | `/notifications/:id/read` | Bearer | Tandai notifikasi dibaca |
| POST | `/chat/conversations` | Bearer | Mulai/ambil conversation (body: `recipientProfileId`, `originType`: PROFILE\|NEED\|OFFER, `opportunityId`?) |
| GET | `/chat/conversations` | Bearer | List conversation saya |
| GET | `/chat/conversations/:id/messages` | Bearer | Riwayat pesan (pagination) |
| POST | `/chat/conversations/:id/messages` | Bearer | Kirim pesan (REST fallback / upload image-attachment) |
| PATCH | `/chat/conversations/:id/read` | Bearer | Tandai sudah dibaca |
| GET | `/membership/plans` | Publik | List paket membership + harga aktif |
| GET | `/membership/me` | Bearer | Status membership saya |
| POST | `/membership/checkout` | Bearer | Mulai transaksi pembayaran (Midtrans Snap), dapat `paymentUrl` |
| POST | `/membership/webhook/:provider` | Publik (signature-verified) | Webhook notifikasi payment gateway |
| GET | `/membership/transactions/me` | Bearer | Riwayat transaksi/invoice saya |
| POST | `/membership/dev-activate` | Bearer | **STUB DEV** — aktivasi manual (diblokir di production) |
| POST | `/pricing/plans/:planId` | Bearer + role ADMIN | Tetapkan harga baru (harga lama diarsipkan, histori utuh) |
| GET | `/pricing/plans/:planId` | Bearer + role ADMIN | Riwayat harga sebuah plan |
| GET | `/fraud-flags` | Bearer + role ADMIN | List insiden fraud (filter `status`) |
| GET | `/fraud-flags/:id` | Bearer + role ADMIN | Detail insiden + kedua Party + Deal terkait |
| PATCH | `/fraud-flags/:id/review` | Bearer + role ADMIN | Putuskan CONFIRMED/DISMISSED |
| POST | `/decision/inquiries` | Publik (opsional Bearer) | Mulai diagnosis Business Decision Engine dari `statedWant` |
| GET | `/decision/inquiries/:id` | Publik | Status diagnosis (Job terdiagnosis, confidence, dataSufficiency) |
| POST | `/decision/inquiries/:id/answers` | Publik | Jawab pertanyaan klarifikasi, memicu re-diagnosis |
| GET | `/decision/inquiries/:id/recommendations` | Publik | Rekomendasi final (Opportunity nyata atau data-gap alert) |
| GET | `/decision/knowledge` | Publik | List basis pengetahuan (SolutionCategory → Job → RootProblem) |
| POST | `/decision/knowledge` | Bearer + role ADMIN | Tambah entri basis pengetahuan baru |
| GET | `/business-diagnosis/symptoms` | Publik | Katalog gejala bisnis yang tersedia |
| POST | `/business-diagnosis/sessions` | Bearer | Mulai sesi diagnosis (auto-pull data Party kalau `partyId` disertakan) |
| GET | `/business-diagnosis/sessions/:id` | Publik | Status diagnosis saat ini |
| POST | `/business-diagnosis/sessions/:id/factors` | Publik | Isi satu DiagnosticFactor manual |
| GET | `/business-diagnosis/sessions/:id/recommendations` | Publik | Rekomendasi akhir (advisory dan/atau match Opportunity) |
| GET | `/business-diagnosis/knowledge` | Publik | List basis pengetahuan diagnosis |
| POST | `/business-diagnosis/knowledge` | Bearer + role ADMIN | Tambah basis pengetahuan baru |
| PATCH | `/business-diagnosis/advisory/:id/publish` | Bearer + role ADMIN | Publikasikan draft advisory |
| POST | `/intent` | Publik (opsional Bearer) | **Pintu masuk tunggal** — klasifikasi + orkestrasi otomatis ke Matching atau Business Intelligence |
| POST | `/reports` | Bearer | Laporkan sebuah Profile (spam, penipuan, dst) |
| GET | `/reports` | Bearer | List laporan yang saya buat |
| GET | `/admin/dashboard` | Bearer + role ADMIN | Statistik ringkas platform |
| GET | `/admin/users` | Bearer + role ADMIN | List user (filter search, accountStatus) |
| GET | `/admin/users/:id` | Bearer + role ADMIN | Detail user |
| PATCH | `/admin/users/:id/status` | Bearer + role ADMIN | Suspend/ban/pulihkan akun |
| GET | `/admin/opportunities` | Bearer + role ADMIN | List Opportunity untuk moderasi |
| PATCH | `/admin/opportunities/:id/status` | Bearer + role ADMIN | Paksa ubah status (moderasi) |
| GET | `/admin/reviews` | Bearer + role ADMIN | List Review untuk moderasi |
| PATCH | `/admin/reviews/:id/visibility` | Bearer + role ADMIN | Sembunyikan/tampilkan Review |
| GET | `/admin/reports` | Bearer + role ADMIN | List laporan user |
| PATCH | `/admin/reports/:id` | Bearer + role ADMIN | Tinjau laporan |
| GET | `/admin/transactions` | Bearer + role ADMIN | List transaksi membership lintas semua user |
| GET | `/content/pages/:slug` | Publik | Halaman statis (Tentang Kami, dst) yang PUBLISHED |
| GET | `/content/faq` | Publik | List FAQ yang PUBLISHED |
| GET | `/admin/content/pages` | Bearer + role ADMIN | List semua halaman (semua status) |
| GET | `/admin/content/pages/:slug` | Bearer + role ADMIN | Detail halaman (semua status) |
| PUT | `/admin/content/pages/:slug` | Bearer + role ADMIN | Upsert halaman (buat/update + set status) |
| GET | `/admin/content/faq` | Bearer + role ADMIN | List semua FAQ (semua status) |
| POST | `/admin/content/faq` | Bearer + role ADMIN | Buat FAQ baru |
| PATCH | `/admin/content/faq/:id` | Bearer + role ADMIN | Update FAQ |
| DELETE | `/admin/content/faq/:id` | Bearer + role ADMIN | Hapus FAQ |
| GET | `/health` | Publik | Health check |
| GET | `/marketplace/products` | Publik | List produk marketplace (filter, search) |
| GET | `/marketplace/products/:id` | Publik | Detail produk |
| GET | `/marketplace/products/my/products` | Bearer (seller) | List produk milik sendiri |
| POST | `/marketplace/products` | Bearer (seller) | Buat produk baru |
| PATCH | `/marketplace/products/:id` | Bearer (owner) | Update produk |
| DELETE | `/marketplace/products/:id` | Bearer (owner) | Hapus produk |
| POST | `/marketplace/products/:id/media` | Bearer (owner) | Upload media produk (multipart `file`) |
| DELETE | `/marketplace/products/:id/media/:mediaId` | Bearer (owner) | Hapus media produk |
| PATCH | `/marketplace/products/:id/media/:mediaId/primary` | Bearer (owner) | Set media utama produk |
| GET | `/marketplace/cart` | Bearer | Lihat keranjang milik sendiri |
| POST | `/marketplace/cart/items` | Bearer | Tambah item ke keranjang |
| PATCH | `/marketplace/cart/items/:itemId` | Bearer | Update qty item keranjang |
| DELETE | `/marketplace/cart/items/:itemId` | Bearer | Hapus item dari keranjang |
| DELETE | `/marketplace/cart` | Bearer | Kosongkan keranjang |
| POST | `/marketplace/orders/checkout` | Bearer | Checkout keranjang → Order (+ sub-order per seller) |
| GET | `/marketplace/orders/my/orders` | Bearer (buyer) | List order milik sendiri sebagai pembeli |
| GET | `/marketplace/orders/my/sales` | Bearer (seller) | List sub-order milik sendiri sebagai penjual |
| GET | `/marketplace/orders/:id` | Bearer (pihak terkait) | Detail Order |
| PATCH | `/marketplace/orders/sub-orders/:subOrderId/status` | Bearer (seller) | Update status sub-order (proses/kirim/dst) |
| POST | `/marketplace/orders/sub-orders/:subOrderId/confirm` | Bearer (buyer) | Konfirmasi barang diterima |
| GET | `/marketplace/products/:productId/reviews` | Publik | List review sebuah produk |
| POST | `/marketplace/products/:productId/reviews` | Bearer (buyer) | Beri review produk |
| PATCH | `/marketplace/reviews/:reviewId` | Bearer (owner) | Update review produk sendiri |
| DELETE | `/marketplace/reviews/:reviewId` | Bearer (owner) | Hapus review produk sendiri |
| POST | `/escrow/hold` | Bearer (sesi terverifikasi) | Mulai hold dana escrow Buyer↔Seller Party |
| GET | `/escrow` | Bearer | List Escrow milik Party sendiri |
| GET | `/escrow/:id` | Bearer (partisipan) | Detail Escrow |
| POST | `/escrow/:id/seller-confirm` | Bearer (Seller) | Konfirmasi Seller |
| POST | `/escrow/:id/buyer-confirm` | Bearer (Buyer) | Konfirmasi Buyer |
| POST | `/escrow/:id/release` | Bearer (Buyer) | Release dana ke Seller |
| POST | `/escrow/:id/refund` | Bearer (partisipan) | Refund dana ke Buyer |
| POST | `/escrow/:id/dispute` | Bearer (partisipan) | Ajukan dispute |

**Business Suite** — party-scoped, hidup di bawah namespace `/parties/:partyId/...`
yang sama dengan modul Party (lihat catatan mounting di `src/routes/v1/index.js`):

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/parties/:partyId/contacts` | Bearer | List kontak (customer/supplier) Party |
| GET | `/parties/:partyId/contacts/:contactId` | Bearer | Detail kontak |
| POST | `/parties/:partyId/contacts` | Bearer | Buat kontak baru |
| PATCH | `/parties/:partyId/contacts/:contactId` | Bearer | Update kontak |
| DELETE | `/parties/:partyId/contacts/:contactId` | Bearer | Hapus kontak |
| GET | `/parties/:partyId/cashbook/summary` | Bearer | Ringkasan kas masuk/keluar |
| GET | `/parties/:partyId/cashbook` | Bearer | List entri kas |
| POST | `/parties/:partyId/cashbook` | Bearer | Tambah entri kas |
| DELETE | `/parties/:partyId/cashbook/:entryId` | Bearer | Hapus entri kas |
| GET | `/parties/:partyId/contacts/:contactId/receivable-card` | Bearer | Ringkasan piutang ke satu kontak |
| GET | `/parties/:partyId/contacts/:contactId/receivable-card/entries` | Bearer | List entri piutang |
| POST | `/parties/:partyId/contacts/:contactId/receivable-card/entries` | Bearer | Tambah entri piutang |
| GET | `/parties/:partyId/contacts/:contactId/debt-card` | Bearer | Ringkasan hutang ke satu kontak |
| GET | `/parties/:partyId/contacts/:contactId/debt-card/entries` | Bearer | List entri hutang |
| POST | `/parties/:partyId/contacts/:contactId/debt-card/entries` | Bearer | Tambah entri hutang |
| GET | `/parties/:partyId/inventory-cards` | Bearer | List semua kartu persediaan Party |
| GET | `/parties/:partyId/products/:productId/inventory-card` | Bearer | Ringkasan persediaan satu produk |
| GET | `/parties/:partyId/products/:productId/inventory-card/entries` | Bearer | List entri mutasi persediaan |
| POST | `/parties/:partyId/products/:productId/inventory-card/entries` | Bearer | Tambah entri mutasi persediaan |
| GET | `/parties/:partyId/tasks` | Bearer | List task Party |
| GET | `/parties/:partyId/tasks/:taskId` | Bearer | Detail task |
| POST | `/parties/:partyId/tasks` | Bearer | Buat task baru |
| PATCH | `/parties/:partyId/tasks/:taskId` | Bearer | Update task |
| DELETE | `/parties/:partyId/tasks/:taskId` | Bearer | Hapus task |
| GET | `/parties/:partyId/agenda` | Bearer | List agenda/kalender Party |
| GET | `/parties/:partyId/agenda/:agendaId` | Bearer | Detail agenda |
| POST | `/parties/:partyId/agenda` | Bearer | Buat agenda baru |
| PATCH | `/parties/:partyId/agenda/:agendaId` | Bearer | Update agenda |
| DELETE | `/parties/:partyId/agenda/:agendaId` | Bearer | Hapus agenda |
| GET | `/parties/:partyId/dashboard` | Bearer | Ringkasan dashboard Business Suite (cache) |
| POST | `/parties/:partyId/dashboard/refresh` | Bearer | Paksa refresh cache dashboard |

> Modul di atas (Marketplace, Escrow, Business Suite) belum punya JSDoc `@openapi`
> lengkap per-endpoint (kecuali Escrow — lihat `src/modules/escrow/escrow.routes.js`);
> tabel ini adalah kontrak sementara. Body/response detail: lihat masing-masing
> `*.validation.js` dan `*.controller.js` di modul terkait.

## HTTP Status Reference

Untuk daftar lengkap `code` (machine-readable) per situasi, lihat
[`docs/api/error-codes.md`](api/error-codes.md). Ringkasan status HTTP:

| HTTP Status | Arti |
|---|---|
| 400 | Validasi gagal / request tidak valid |
| 401 | Token tidak ada/invalid/expired |
| 402 | Payment required *(disiapkan, belum dipakai endpoint manapun)* |
| 403 | Tidak punya akses ke resource ini |
| 404 | Resource tidak ditemukan |
| 409 | Konflik (mis. status transition tidak valid, duplikasi, Fraud Detection block) |
| 500 | Internal server error |
