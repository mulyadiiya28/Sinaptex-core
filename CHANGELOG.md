# Changelog

Semua perubahan penting pada project ini dicatat di file ini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan project ini mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- Governance repo lengkap (LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CODEOWNERS)
- Dokumen master checklist (`docs/PROJECT_CHECKLIST.md`)

### Fixed
- **`src/core/socket.js` — WS session revalidation tidak me-re-check status ban/suspend.**
  `revalidateSession()` sebelumnya hanya memvalidasi token Supabase secara berkala;
  akun yang di-ban/suspend admin di tengah sesi tetap bisa terus pakai koneksi WS
  sampai token expire atau disconnect manual. Sekarang setiap siklus revalidasi
  query ulang `profile.accountStatus` ke DB dan meng-evict sesi (`session:expired`,
  code `ACCOUNT_BANNED` / `ACCOUNT_SUSPENDED`) begitu status berubah.
- **`src/core/socket.js` — ban gate di handshake WS tidak pernah aktif.** Kode lama
  mengecek `user.profile.status`, padahal field di `prisma/schema.prisma` bernama
  `accountStatus` — kondisi `undefined === 'BANNED'` selalu `false`, jadi user
  BANNED/SUSPENDED tetap lolos konek WebSocket. Diperbaiki ke `accountStatus`.

### Changed
- `README.md`: sinkronkan tabel status Security dengan kode aktual setelah patch di atas.
- Swagger (`@openapi` JSDoc) ditambahkan lengkap per-endpoint untuk 8 modul yang
  sebelumnya nol dokumentasi: `auth`, `profile`, `admin`, `escrow`, `verification`,
  `notification`, `review` (deal), `invitation`. Endpoint yang sebelumnya belum
  ter-cover di `chat` (report/read) dan `opportunity` (close, documents) dilengkapi.
  Total path di spec naik dari ~15 ke 78 (diverifikasi via `swagger-jsdoc` — spec
  ter-generate tanpa error).
- `docs/api-contract.md`: tambah baris kontrak untuk Marketplace (product/cart/order/
  review) dan Business Suite (contact/cashbook/receivable/debt/inventory/task/agenda/
  dashboard) yang sebelumnya tidak terdaftar sama sekali di dokumen ini.
- `src/routes/v1/index.js`: perbaiki komentar yang salah — router Business Suite
  ternyata **tidak** di-mount di prefix `/business-suite` (tidak ada path prefix
  sama sekali di `router.use(...)`), melainkan langsung numpang di namespace
  `/parties/:partyId/...` yang sama dengan modul Party.

## [0.1.0] - 2026-08-01
### Added
- Inisialisasi engine Express + Prisma + Zod + Cloudinary + Supabase
- Auth sync dari Supabase Auth (register/me)
- Verification Engine (upload dokumen, review status)
- Opportunity module (Need/Offer, capability, media)
- Boost Engine (Free/Basic/Premium/VIP)
- Matching Engine (hard filter + weighted scoring)
- Ranking Engine (composite score + party stats)
- Invitation → Deal state machine (negotiation → deal → in progress → completed/cancelled)
- Review & Notification module
