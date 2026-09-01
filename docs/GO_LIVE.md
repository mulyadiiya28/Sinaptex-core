# Go-Live Priority Checklist (Sinaptex MVP)

Urutan berdasarkan blocker → dampak user → nice-to-have.

## P0 — Wajib sebelum soft-launch publik

| # | Item | Status | Aksi |
|---|------|--------|------|
| 1 | **Database production sehat** | 🔴 ops | Pastikan `DATABASE_URL` (pooler `6543` + `?pgbouncer=true`) & `DIRECT_URL` (5432). `GET /api/v1/health` → `database: ok`, HTTP 200 |
| 2 | **Redis (Upstash)** | 🟡 ops | Env `REDIS_URL=rediss://...` + restart. Health → `redis: ok`, `cache: ok`. Password pernah bocor → **reset** di Upstash |
| 3 | **Migrate + seed production** | 🟡 ops | `npx prisma migrate deploy` lalu `npx prisma db seed` (plans, kategori, CMS legal PUBLISHED) |
| 4 | **Midtrans sandbox → production** | 🟡 ops | `MIDTRANS_IS_PRODUCTION=true`, server/client key production. Notification URL: `https://<domain>/api/v1/membership/webhook/midtrans` |
| 5 | **CORS / CLIENT_URL** | 🟡 ops | `CLIENT_URL` + `ALLOWED_ORIGINS` = domain frontend |
| 6 | **Konten legal** | 🟢 kode | Seed sudah publish `syarat-ketentuan`, `kebijakan-privasi`, `kontak`. **Review hukum** sebelum claim compliance penuh |
| 7 | **Cron Hostinger** | 🟡 ops | `jobs:frequent` tiap 15 mnt, `jobs:daily` 1×/hari — update path version setelah redeploy |

## P1 — Soft-launch (bisa menyusul 1–2 minggu)

| # | Item | Catatan |
|---|------|---------|
| 8 | Uji end-to-end membership checkout + webhook sandbox | Snap URL → bayar → status ACTIVE |
| 9 | Uji boost berbayar + ranking hanya PAID | |
| 10 | Google OAuth di Supabase dashboard | Backend tidak perlu ubah |
| 11 | Monitor health + log error 24 jam pertama | |

## P2 — Post-MVP

| # | Item |
|---|------|
| 12 | Escrow payout bank + dispute mediation penuh (modul escrow sudah ada hold/confirm/release/refund/dispute) |
| 13 | Email/WhatsApp provider production (mailer skeleton ada) |
| 14 | Integration / E2E test suite |

## Verifikasi cepat setelah deploy

```bash
curl -s https://cahayaastera.com/api/v1/health | jq
# target: database ok, redis ok (jika REDIS_URL diset), HTTP 200

curl -s https://cahayaastera.com/api/v1/content/pages/syarat-ketentuan | jq '.data.slug,.data.status'
curl -s https://cahayaastera.com/api/v1/content/pages/kebijakan-privasi | jq '.data.slug,.data.status'
curl -s https://cahayaastera.com/api/v1/membership/plans | jq '.success'
```

## Env minimum production

```env
NODE_ENV=production
DATABASE_URL=...
DIRECT_URL=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
CLIENT_URL=https://frontend-domain
ALLOWED_ORIGINS=https://frontend-domain
CLOUDINARY_*=...
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=true
REDIS_URL=rediss://default:...@....upstash.io:6379
CACHE_ENABLED=true
```
