# Deployment Guide

> **Status: TEMPLATE dasar.** Sesuaikan platform hosting sebenarnya (Railway, Render, Fly.io,
> VPS + Docker, dll) — belum ada Dockerfile/CI di repo ini (lihat Phase 15 di `PROJECT_CHECKLIST.md`).

## Prasyarat
- Node.js 18+ LTS
- Project Supabase sudah dibuat (DB + Auth)
- Akun Cloudinary sudah dibuat
- Environment variable production disiapkan (lihat `.env.example`)

## Langkah Deploy Manual (generic Node hosting)

```bash
# 1. Clone & install
git clone <repo-url>
cd business-matching-bridge
npm ci --omit=dev

# 2. Set environment variables (lewat platform hosting, jangan commit .env)

# 3. Generate Prisma client & migrate
npx prisma generate
npx prisma migrate deploy   # (bukan `migrate dev` — untuk production)

# 4. Seed data awal (sekali saja, atau saat data master berubah)
npx prisma db seed

# 5. Jalankan
npm start
```

## Checklist Sebelum Deploy
- [ ] Semua env var production terisi (`DATABASE_URL`, `SUPABASE_*`, `CLOUDINARY_*`)
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL` diarahkan ke domain frontend production (untuk CORS)
- [ ] Migration sudah dijalankan di DB production
- [ ] Boost plan & kategori dasar sudah di-seed

## Rencana Selanjutnya (belum ada)
- Dockerfile + docker-compose untuk konsistensi environment
- GitHub Actions: lint → test → build → deploy otomatis dari `main`
- Reverse proxy (Nginx) + SSL/TLS jika self-host
