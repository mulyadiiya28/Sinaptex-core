# Sinaptex — API Engine

Backend engine untuk platform *business matching* **Sinaptex**.

Stack: **Node.js + Express**, **Prisma ORM**, **Zod**, **Cloudinary**, **Supabase** (Postgres + Auth),
**Socket.IO** (chat), **node-cron** / CLI jobs (scheduler).

## Alur utama (revisi produk)

```
Register/Login → Verification → Opportunity (Need gratis / Offer + membership)
  → Boost → Matching → Ranking → User pilih hasil
       ├─ Chat cepat dari Opportunity (tanpa wajib Invitation)     ← FR-16, policy kode belum final
       └─ Invitation formal → Accept → Deal → … → Completed
```

**Invitation bukan satu-satunya jalan komunikasi.** Invitation = jalur formal ke Deal.
Chat dari Opportunity dirancang paralel (lihat `docs/product-decisions-offer-chat.md`).

Dokumen produk / FR:
- `docs/product-decisions-offer-chat.md` — keputusan Offer, membership, chat
- `docs/functional-requirement.md` — FR-15 / FR-16 / FR-17
- `docs/flowchart.md`, `docs/state-machines.md`
- `docs/deployment-guide.md` — deploy + **cron Hostinger**

---

## Status fitur (singkat)

| Area | Status |
|------|--------|
| Auth, verification, matching, ranking, invitation, deal | ✅ |
| Offer wajib membership aktif | ✅ |
| Kuota max **20** Offer ACTIVE / profile | ✅ |
| Membership expire → sisa **1** Offer, sisanya CLOSED | ✅ (job `expireMemberships`) |
| CLI job untuk shared hosting (`run-once.js`) | ✅ |
| Chat dari Opportunity **tanpa** membership + rate limit (FR-16) | ⬜ **belum** — policy lama masih di kode |
| Invitation bukan syarat chat | ⬜ docs ✅, UX/policy kode ⬜ |

---

## 1. Struktur Project

```
prisma/schema.prisma
prisma/seed.js
src/config/                  # env, prisma, cloudinary, supabase, scheduler.config
src/jobs/
  scheduler.js               # process panjang (VPS/Docker)
  run-once.js                # one-shot untuk Cron Hostinger
  expireMemberships.job.js   # + trim Offer (FR-15)
  expireOpportunities.job.js
  …
src/modules/
  auth/  profile/  verification/
  opportunity/   # Need gratis; Offer: membership + kuota
  boost/  matching/  ranking/
  invitation/    # jalur formal → Deal
  chat/          # policy: src/modules/chat/chat.policy.js (revisi FR-16 menyusul)
  membership/  pricing/  review/  notification/
```

## 2. Setup

### a. Install
```bash
npm install
```

### b. Supabase
1. Project di https://supabase.com
2. Connection string → `DATABASE_URL` & `DIRECT_URL` di `.env`
   - Pooler (port 6543): tambahkan `?pgbouncer=true` pada `DATABASE_URL`
3. API keys + JWT secret → `.env`
4. Auth providers sesuai kebutuhan

### c. Cloudinary
Isi `CLOUDINARY_*` di `.env`.

### d. Env, migrate, seed
```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### e. Jalankan API
```bash
npm run dev     # development
npm start       # production — API saja, scheduler TIDAK ikut
```

Default: `http://localhost:4000`, prefix `/api` (banyak route di `/api/v1/...`).
Swagger: `http://localhost:4000/api/docs`.
Chat WebSocket (Socket.IO) di port yang sama.

### f. Google OAuth
Aktifkan di Supabase (Authentication → Providers → Google). Backend hanya verifikasi access token.

### g. Background jobs

**Shared hosting (Hostinger)** — jangan andalkan process `scheduler` 24 jam. Pakai Cron + CLI:

```bash
npm run jobs:frequent   # expire opportunity + invitation
npm run jobs:daily      # membership (+ trim Offer), stats, cleanup, fraud
npm run jobs:once -- expireMemberships
```

Panduan cron hPanel: **`docs/deployment-guide.md`**.

**VPS / Docker** — process terpisah:

```bash
npm run scheduler            # node-cron hidup terus
npm run worker:party-stats   # butuh REDIS_URL
npm run worker:notification  # butuh REDIS_URL
```

Tanpa Redis, API tetap jalan (cache/queue no-op).

### h. Membership dev (non-production)
```bash
curl -X POST http://localhost:4000/api/v1/membership/dev-activate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "durationDays": 30 }'
```
Diblokir otomatis jika `NODE_ENV=production`.

---

## 3. Opportunity (Need / Offer)

| Tipe | Aturan |
|------|--------|
| **NEED** | Gratis, tanpa membership |
| **OFFER** | Membership **ACTIVE** wajib; max **20** Offer `ACTIVE` per Profile |
| Membership **EXPIRED** | Job menyisakan **1** Offer terbaru `ACTIVE`, sisanya `CLOSED` |

Error terkait: `MEMBERSHIP_REQUIRED`, `OFFER_QUOTA_EXCEEDED`.

Konstanta: `src/shared/constants.js` (`MAX_ACTIVE_OFFERS`, `OFFERS_KEPT_AFTER_MEMBERSHIP_EXPIRE`).

---

## 4. Invitation vs Chat

| Jalur | Fungsi | Status kode |
|-------|--------|-------------|
| **Invitation** | Formal matching → Accept → Deal | ✅ |
| **Chat dari Opportunity** | Komunikasi cepat, paralel invitation | Policy **lama** masih gate membership untuk OFFER/PROFILE — **FR-16 belum diimplementasi** |

Saat ini di `chat.policy.js` (perilaku *berjalan* di production):
- `originType: NEED` — tanpa gate membership
- `originType: OFFER` / `PROFILE` — masih memerlukan membership aktif (penerima / aturan policy lama)

Target produk (docs, belum kode): chat dari Opportunity (NEED/OFFER) tanpa membership + rate limit anti-spam.
Detail: `docs/product-decisions-offer-chat.md`.

### Socket.IO (ringkas)
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { auth: { token: supabaseAccessToken } });
socket.on('message:new', (message) => {});
socket.emit('message:send', { conversationId, content: 'Halo!' }, (ack) => {});
```
Upload media: `POST /api/v1/chat/conversations/:id/messages` (multipart).

---

## 5. Autentikasi

Auth di client via Supabase. Backend:
1. `Authorization: Bearer <supabase_access_token>`
2. Verifikasi token
3. Sinkron `users` + `profiles`

```
POST /api/auth/register   (Bearer)
GET  /api/auth/me         (Bearer)
```

## 6. Ringkasan endpoint

| Step | Modul | Endpoint (prefix sering `/api` atau `/api/v1`) |
|------|--------|------------------------------------------------|
| Register/Login | auth | `POST /auth/register`, `GET /auth/me` |
| Verification | verification | upload + review admin |
| Opportunity | opportunities | CRUD + media |
| Boost | boosts | plans + activate |
| Matching | matching | `GET /matching/:opportunityId/run` |
| Invitation | invitations | create, respond |
| Deal | invitations/deals | list, patch status |
| Chat | chat | conversations + messages |
| Membership | membership | plans, checkout, webhook |
| Review / notif | reviews, notifications | … |

## 7. Matching & Ranking

Hard filter: tipe berlawanan, `ACTIVE`, kategori, visibility.

Scoring match (0–100): capability, location, budget, tags, text, priority.

Ranking: match + reputation + response + completion + activity + verification + boost − penalty.
Bobot: `RANKING_WEIGHT_*` di env.

## 8. Invitation → Deal state machine

```
Invitation: PENDING → ACCEPTED | REJECTED | EXPIRED
ACCEPTED → Deal(NEGOTIATION)

Deal:
  NEGOTIATION → DEAL | CANCELLED | EXPIRED
  DEAL → IN_PROGRESS | CANCELLED | EXPIRED
  IN_PROGRESS → COMPLETED | CANCELLED
```

Sebelum `COMPLETED`: fraud checks dapat memblokir.

## 9. Keamanan

- Mutasi data: `requireAuth` (token Supabase)
- Cek kepemilikan Party / Opportunity / Deal
- Role ADMIN untuk review dokumen
- Upload max 10MB
- Rate limit global HTTP

## 10. Yang belum / next

- [ ] **FR-16** — longgarkan `chat.policy.js` + rate limit anti-spam
- [ ] Selaraskan FAQ seed yang masih menyebut chat butuh membership penerima
- [ ] Payment gateway penuh untuk boost (selain membership Midtrans)
- [ ] Notifikasi email/WhatsApp

Scheduler opportunity/invitation/membership: **sudah ada** (CLI + `scheduler.js`); di shared host pasang **cron** sesuai `docs/deployment-guide.md`.
