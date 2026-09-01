# Deployment Guide

## Prasyarat
- Node.js 18+ LTS (production Hostinger sering Node 20)
- Project Supabase (DB + Auth)
- Akun Cloudinary
- Env production (lihat `.env.example`) — termasuk `DATABASE_URL` dengan `?pgbouncer=true` jika pakai pooler
- **Redis (opsional tapi disarankan):** Upstash / Redis Cloud — Hostinger shared biasanya **tidak** menyediakan Redis lokal

## Deploy manual (generic / Hostinger Node)

```bash
git clone <repo-url>   # atau pull di folder deploy
cd Applikasi-xxx       # sesuaikan path
npm ci --omit=dev      # atau npm install
npx prisma generate
npx prisma migrate deploy
npm start              # API saja — scheduler TIDAK ikut start
```

### Build Command di Hostinger (WAJIB)

Di pengaturan **Node.js App** Hostinger, isi **Build command** dengan salah satu:

```bash
npm ci --omit=dev && npx prisma generate
```

atau

```bash
npm install && npx prisma generate
```

Tanpa ini, error berikut akan muncul:

```
@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

`postinstall` di package.json sudah berisi `prisma generate`, tapi Hostinger sering melewati postinstall. Build command di atas menjamin client Prisma selalu ter-generate.

## Redis di shared hosting (Hostinger + Upstash)

Shared Node di Hostinger **tidak** menjalankan Redis di `localhost`. Pakai Redis managed:

1. Buat database di [Upstash](https://upstash.com) (region dekat user, mis. Singapore).
2. Di console, copy **Redis URL** (bukan REST URL):
   ```text
   rediss://default:PASSWORD@xxxx.upstash.io:6379
   ```
   - Harus `rediss://` (TLS) dan port **6379**.
3. Di hPanel → Node.js App → **Environment variables**:
   ```env
   REDIS_URL=rediss://default:PASSWORD@xxxx.upstash.io:6379
   CACHE_ENABLED=true
   CACHE_KEY_PREFIX=sinaptex:
   ```
4. **Restart** aplikasi.
5. Verifikasi: `GET /api/v1/health` → `"redis":"ok"`, `"cache":"ok"`.

Tanpa `REDIS_URL`, API tetap jalan; cache & counter chat memakai fallback (lebih banyak hit DB).

**Keamanan:** jangan commit password Redis ke Git. Jika URL pernah bocor, **reset password** di Upstash lalu update env Hostinger.

Nilai health `checks.redis`:

| Nilai | Arti |
|-------|------|
| `ok` | Ping Redis sukses |
| `not_configured` | `REDIS_URL` kosong |
| `disabled` | `CACHE_ENABLED=false` |
| `unavailable` / `error` | Gagal connect (URL/password/TLS) |

`checks.database=error` → HTTP **503**. Redis gagal **tidak** memaksa 503.

## Scheduler di shared hosting (Hostinger)

Process `npm run scheduler` (node-cron hidup terus) **sering tidak cocok** di shared host:
process bisa di-kill, dan biasanya hanya 1 Node app yang diizinkan.

**Solusi:** jalankan job **sekali jalan lalu exit** lewat **Cron Jobs** hPanel.

### Script CLI

| Perintah | Isi |
|----------|-----|
| `npm run jobs:frequent` | expire opportunities + invitations |
| `npm run jobs:daily` | expire memberships (+ trim Offer), party stats, cleanup notif, fraud scan |
| `npm run jobs:once -- expireMemberships` | satu job saja |

File: `src/jobs/run-once.js`.

### Langkah di Hostinger hPanel

1. Buka **Advanced → Cron Jobs** (atau **Cron Jobs** di sidebar).
2. Catat path absolut app Node, contoh:
   ```text
   /home/u726042891/domains/cahayaastera.com/hbuilds/versions/<VERSION_ID>/nodejs
   ```
   Path `VERSION_ID` berubah tiap deploy — setelah redeploy, **update cron** ke folder versi aktif.
3. Cari path binary `node` (SSH):
   ```bash
   which node
   # atau di hPanel Node.js, lihat runtime path
   ```
4. Buat 2 cron (timezone server sering UTC; sesuaikan):

**A. Frequent — setiap 15 menit** (expire opportunity & invitation):

```bash
*/15 * * * * cd /home/uXXXX/domains/cahayaastera.com/hbuilds/versions/AKTIF/nodejs && /usr/bin/node src/jobs/run-once.js --group=frequent >> logs/jobs-frequent.log 2>&1
```

**B. Daily — sekali sehari jam 01:00** (membership + trim Offer, dll.):

```bash
0 1 * * * cd /home/uXXXX/domains/cahayaastera.com/hbuilds/versions/AKTIF/nodejs && /usr/bin/node src/jobs/run-once.js --group=daily >> logs/jobs-daily.log 2>&1
```

Ganti:
- `uXXXX` → user Hostinger kamu
- `AKTIF` → folder version deploy terbaru
- `/usr/bin/node` → output `which node` jika beda

5. Pastikan folder log ada:
   ```bash
   mkdir -p logs
   ```
6. Pastikan file `.env` (atau env di panel Node) terbaca saat cron jalan — `cd` ke root app wajib, karena `dotenv` load dari cwd.

### Uji manual (SSH)

```bash
cd /path/ke/nodejs   # folder yang berisi package.json
node src/jobs/run-once.js expireMemberships
node src/jobs/run-once.js --group=daily
```

Kalau sukses, log menampilkan `run-once: finished job ...` dan exit code 0.

### Setelah redeploy Hostinger

Path `hbuilds/versions/<id>` **berubah**. Update baris cron ke version baru, atau symlink stabil ke “current” jika Hostinger menyediakan.

### Alternatif (bukan shared host)

- VPS / Docker: `npm run scheduler` sebagai process terpisah (lihat `docker-compose.yml` service `scheduler`).
- Jangan andalkan process API (`npm start`) untuk menjalankan cron panjang di shared host.

## Checklist sebelum production

- [ ] Env production lengkap (`DATABASE_URL` + `pgbouncer=true` jika pooler)
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL` = domain frontend (CORS)
- [ ] Migration production sudah jalan (termasuk `chat_rate_limit_policies` jika dipakai)
- [ ] Seed master data (plans, categories) sudah ada
- [ ] **Build command Hostinger** berisi `npx prisma generate`
- [ ] **`REDIS_URL`** (Upstash `rediss://...`) + restart → health `redis: ok`
- [ ] **Cron frequent + daily** terpasang dan path version benar
- [ ] Uji `node src/jobs/run-once.js --group=daily` sekali lewat SSH
- [ ] Midtrans webhook URL production mengarah ke `/api/v1/membership/webhook/...`
