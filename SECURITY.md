# Security Policy

## Versi yang Didukung

| Versi | Didukung |
|---|---|
| 0.x (Unreleased) | ✅ |

## Melaporkan Kerentanan

Jangan buat public Issue untuk kerentanan keamanan. Kirim laporan langsung ke
maintainer (email tim keamanan internal / kontak repo owner) dengan detail:

1. Deskripsi kerentanan dan dampaknya
2. Langkah reproduksi
3. Versi/commit yang terdampak
4. Saran perbaikan (jika ada)

Kami akan konfirmasi penerimaan laporan dalam 3 hari kerja dan memberi update
progres perbaikan secara berkala hingga selesai.

## Praktik Keamanan yang Sudah Diterapkan

- Autentikasi via Supabase Auth (token diverifikasi server-side, tidak ada password disimpan lokal)
- Validasi input wajib (Zod) di semua endpoint mutasi
- Helmet untuk HTTP security headers
- Rate limiting global (`express-rate-limit`)
- Kepemilikan resource (Party/Opportunity/Deal) selalu dicek terhadap user yang login
- File upload dibatasi ukuran & tipe MIME (`upload.middleware.js`)

## Yang Masih Perlu Ditambahkan (lihat `docs/PROJECT_CHECKLIST.md` Phase 16)

- CSP & HSTS header
- Secret rotation terjadwal
- Penetration test berkala
- Audit logging
