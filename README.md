# Sinaptex — API Engine

Backend engine untuk platform *business matching* **Sinaptex**.

Stack: **Node.js + Express**, **Prisma ORM**, **Zod**, **Cloudinary**, **Supabase** (Postgres + Auth),
**Socket.IO** (chat), **Midtrans Snap** (payment adapter), **Redis/Upstash** (cache + rate limit),
**node-cron** / CLI jobs (scheduler).

## Alur utama

```
Register/Login → Verification → Opportunity (Need / Offer)
  → Boost (opsional) → Matching → Ranking → User pilih hasil
       ├─ Chat cepat dari Opportunity (tanpa wajib Invitation)   ← FR-16 ✅
       └─ Invitation formal → Accept → Deal → … → Completed
```

**Invitation bukan satu-satunya jalan komunikasi.** Invitation = jalur formal ke Deal.
Chat dari Opportunity berjalan paralel (lihat `docs/product-decisions-offer-chat.md`).

Dokumen produk / teknis:
- `docs/GO_LIVE.md` — **prioritas go-live (baca ini dulu untuk soft-launch)**
- `docs/PROJECT_CHECKLIST.md` — checklist MVP + enterprise (sebagian dibekukan)
- `docs/product-decisions-offer-chat.md` — Need, Offer, membership, chat
- `docs/functional-requirement.md` — FR-15 / FR-16 / FR-17
- `docs/deployment-guide.md` — deploy Hostinger + cron + Upstash Redis
- `docs/flowchart.md`, `docs/state-machines.md`

---

## Status fitur (MVP backend)

| Area | Status |
|------|--------|
| Auth, Profile, Verification, Party | ✅ |
| Opportunity (Need/Offer) + quota + expire/trim | ✅ |
| Matching + Ranking + self-match / fraud guard | ✅ |
| Invitation → Deal state machine + fraud gate | ✅ |
| Chat (REST + WebSocket) + policy NEED/OFFER gratis | ✅ |
| Chat anti-spam: rate limit conv/hari + unreplied burst (env + admin) | ✅ |
| Report peer dari chat | ✅ |
| Membership + Pricing + Midtrans checkout/webhook | ✅ kode |
| Boost FREE / berbayar via Midtrans; ranking hanya PAID | ✅ |
| Redis cache (plans, CMS, matching, membership flag) | ✅ |
| Health: DB + Redis/cache | ✅ |
| Notifikasi in-app + reminder membership H-3/H-1 | ✅ |
| Admin API + CMS + chat rate-limit settings | ✅ |
| Konten legal seed (S&K / Privasi / Kontak) PUBLISHED | ✅ kerangka; review hukum ops |
| **Production DB + REDIS_URL + Midtrans prod** | 🔴 blocker ops |
| Google OAuth | ⬜ Supabase dashboard |
| Escrow hold/confirm/release/refund/dispute | 🟡 modul ada; payout bank lanjut |
| Email / WhatsApp production | ⬜ post-MVP |

---

## 1. Setup ringkas

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, SUPABASE_*, CLOUDINARY_*, MIDTRANS_*, REDIS_URL
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
# atau hanya legal CMS: node prisma/seed-legal-content.js
npm run dev
```

Swagger: `/api/docs`. Health: `GET /api/v1/health`.

**Hostinger build command:**
```bash
npm ci --omit=dev && npx prisma generate
```

**Redis (shared host):** buat DB di Upstash → env `REDIS_URL=rediss://default:...@host:6379` → restart.
Detail: `docs/deployment-guide.md`.

**Jobs Hostinger cron:** `docs/deployment-guide.md` + `docs/GO_LIVE.md`.

---

## 2. Payment webhook

```text
https://<domain>/api/v1/membership/webhook/midtrans
```

Memproses membership (`INV-…`) dan boost (`BOOST-{id}`). Signature + amount + claim atomik.

---

## 3. Chat anti-spam

Default env / admin override (`GET|PATCH /admin/settings/chat-rate-limit`):

- Percakapan baru/hari (WIB): free 5, member 30
- Unreplied burst: 20 pesan / window 1 jam

---

## 4. Keamanan (ringkas)

CORS whitelist, Supabase JWT, RBAC ADMIN, Zod, rate limit global/intent/webhook/report,
chat anti-spam, webhook payment hardened, account suspend/ban.

---

## 5. Roadmap

Lihat **`docs/GO_LIVE.md`** untuk urutan P0/P1/P2. Backlog produk: escrow payout bank,
notifikasi email/WA, E2E tests, optimasi matching skala besar.

---

## Lisensi & kontribusi

Lihat `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
