# Changelog

Semua perubahan penting pada project ini dicatat di file ini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan project ini mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- Governance repo lengkap (LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CODEOWNERS)
- Dokumen master checklist (`docs/PROJECT_CHECKLIST.md`)

### Changed
- `README.md`: sinkronkan tabel status Security dengan kode aktual — revalidasi JWT WS,
  rate limit event WS (`message:send`/`typing:*`), dan sanitasi error socket
  (`sanitizeError`) ternyata sudah terimplementasi, bukan lagi 🔴/🟡.
  Sisa gap yang dikonfirmasi: `revalidateSession()` di `src/core/socket.js` baru
  memvalidasi token, belum me-re-check `profile.status` (ban/suspend) secara berkala.

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
