# Non-Functional Requirement (NFR)

## Performance
- Target response time API < 300ms (p95) untuk endpoint non-matching
- Endpoint `matching/:opportunityId/run` boleh lebih lambat (kompleksitas O(n) kandidat),
  target < 2s untuk pool kandidat ≤ 200 (lihat `take: 200` di `matching.controller.js`)

## Scalability
- Stateless Express instance → bisa horizontal scale di belakang load balancer
- DB (Supabase Postgres) jadi sumber state utama; sesi tidak disimpan di memory server

## Availability
- Target uptime: **TEMPLATE — isi SLA sesuai kebutuhan bisnis (mis. 99.5%)**
- Graceful shutdown sudah diimplementasi (`server.js`, SIGINT/SIGTERM)

## Security
- Lihat `SECURITY.md` untuk detail kontrol yang sudah/belum diterapkan

## Maintainability
- Struktur modular per domain (`src/modules/<domain>`)
- Validasi terpusat via Zod (`src/validations/`)

## Observability
- **TEMPLATE — belum ada.** Rencana: structured logging (pino/winston), error tracking (Sentry),
  health check lebih lengkap (cek koneksi DB & Cloudinary), lihat Phase 14 di `PROJECT_CHECKLIST.md`

## Data Retention & Privacy
- **TEMPLATE — isi kebijakan retensi data dokumen verifikasi, PII user, dsb sesuai regulasi (UU PDP)**
