# Disaster Recovery Plan

> **Status: TEMPLATE — lengkapi RTO/RPO dan kontak on-call sesuai kebutuhan bisnis.**

## Target
- **RTO (Recovery Time Objective):** **TEMPLATE** (mis. < 4 jam)
- **RPO (Recovery Point Objective):** **TEMPLATE** (mis. < 24 jam data loss maksimal)

## Skenario & Respons

### 1. Database Supabase Down/Corrupt
1. Cek status di Supabase status page
2. Jika perlu restore: gunakan point-in-time recovery Supabase (Pro tier) atau restore
   dari backup manual terbaru (`docs/backup-strategy.md`)
3. Validasi integritas data (jumlah row kunci: User, Party, Opportunity, Deal)
4. Update `DATABASE_URL`/`DIRECT_URL` jika endpoint berubah, redeploy API

### 2. Cloudinary Down/File Hilang
1. API tetap jalan (URL file tersimpan di DB), tapi file tidak bisa diakses
2. Jika file hilang permanen, restore dari backup Cloudinary/replika eksternal
3. Untuk dokumen verifikasi kritikal, minta user re-upload sebagai fallback terakhir

### 3. API Server Down
1. Cek health check `/api/health`
2. Restart service / rollback ke versi sebelumnya (image/commit terakhir yang stabil)
3. Jika root cause di kode, revert commit via `git revert`, deploy ulang dari `main`

### 4. Kebocoran Kredensial (Supabase service role key / Cloudinary secret)
1. Rotate key segera di dashboard masing-masing
2. Update env var di semua environment (production/staging)
3. Audit log akses untuk cek penyalahgunaan

## Kontak Darurat
**TEMPLATE — isi nama & kontak on-call.**
