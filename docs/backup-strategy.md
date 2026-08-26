# Backup Strategy

> **Status: TEMPLATE — sesuaikan dengan paket Supabase yang dipakai.**

## Database (Supabase Postgres)
- Supabase menyediakan automatic daily backup bawaan (tergantung tier: Free = terbatas,
  Pro ke atas = point-in-time recovery)
- **Rekomendasi tambahan:** jadwalkan `pg_dump` mandiri via cron job eksternal untuk
  redundansi, simpan ke object storage terpisah (mis. Cloudflare R2 / S3)

```bash
# Contoh manual dump (jalankan dari mesin dengan akses DIRECT_URL)
pg_dump "$DIRECT_URL" -F c -f backup_$(date +%Y%m%d).dump
```

## File Storage (Cloudinary)
- Cloudinary menyimpan versi asli file yang diupload; aktifkan **backup add-on** Cloudinary
  jika butuh redundansi ekstra, atau replikasi `cloudinaryId` + metadata secara berkala
  ke storage lain

## Frekuensi (isi sesuai kebutuhan bisnis)
| Data | Frekuensi Backup | Retensi |
|---|---|---|
| Database | **TEMPLATE** (mis. harian) | **TEMPLATE** (mis. 30 hari) |
| File verifikasi (Cloudinary) | **TEMPLATE** | **TEMPLATE** |

## Verifikasi Backup
- Lakukan restore test berkala ke environment staging untuk memastikan backup valid
  (lihat `docs/disaster-recovery.md`)
