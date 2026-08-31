# Sinaptex — API Engine

Backend engine untuk platform *business matching* **Sinaptex**.

Stack: **Node.js + Express**, **Prisma ORM**, **Zod**, **Cloudinary**, **Supabase** (Postgres + Auth),
**Socket.IO** (chat), **Midtrans Snap** (payment adapter), **node-cron** / CLI jobs (scheduler).

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
- `docs/PROJECT_CHECKLIST.md` — checklist MVP + enterprise (sebagian dibekukan)
- `docs/product-decisions-offer-chat.md` — Need, Offer, membership, chat
- `docs/functional-requirement.md` — FR-15 / FR-16 / FR-17
- `docs/deployment-guide.md` — deploy Hostinger + cron
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
| Chat anti-spam: rate limit conv/hari + unreplied burst | ✅ |
| Report peer dari chat (`POST .../conversations/:id/report`) | ✅ |
| Membership + Pricing + Midtrans checkout/webhook | ✅ kode |
| Boost FREE langsung; berbayar via Midtrans + ranking hanya PAID | ✅ |
| Notifikasi **in-app** (chat, deal, invitation, review, verif) | ✅ |
| Admin panel API (users, CMS, reports, transactions, …) | ✅ |
| Fraud flags review API | ✅ (modul dibekukan pengembangan, tetap aktif) |
| Rate limit: global + intent + webhook + report + strict | ✅ |
| Health check DB (`/api/v1/health`) + Prisma error code | ✅ |
| **Production DB healthy** (ops Hostinger/Supabase) | 🔴 blocker go-live |
| Konten legal S&K / Privasi **PUBLISHED** (admin CMS) | ⬜ ops |
| Email / WhatsApp notification (FR-12) | ⬜ post-MVP |
| Escrow rekber end-to-end | 🟡 schema + service ada; payout/dispute lanjut |
| Google OAuth | ⬜ aktifkan di dashboard Supabase |

---

## 1. Struktur project (ringkas)

```
prisma/schema.prisma
prisma/seed.js
src/config/           # env, prisma, payment, throttle, cors, …
src/core/payment/     # PaymentGateway factory + MidtransGateway
src/modules/
  auth/ profile/ party/ verification/
  opportunity/ boost/ matching/ ranking/
  invitation/ chat/ membership/ pricing/
  notification/ review/ report/ admin/ content/
  escrow/ fraud/ decision/ business-diagnosis/ intent/
src/jobs/             # scheduler + run-once (Hostinger cron)
src/middlewares/      # auth, rateLimit, validate, error
```

---

## 2. Setup

### a. Install
```bash
npm install
```

### b. Supabase
1. Project di https://supabase.com
2. `DATABASE_URL` (pooler port **6543** + `?pgbouncer=true`) dan `DIRECT_URL` (session **5432**)
3. API keys + JWT secret di `.env`

### c. Cloudinary & Midtrans
```env
CLOUDINARY_CLOUD_NAME=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…

MIDTRANS_SERVER_KEY=…
MIDTRANS_CLIENT_KEY=…
MIDTRANS_IS_PRODUCTION=false   # true di production
```

Notification URL Midtrans (dashboard):
```text
https://<domain>/api/v1/membership/webhook/midtrans
```
Webhook memproses order membership (`INV-…`) dan boost (`BOOST-{id}`).

### d. Env, migrate, seed
```bash
cp .env.example .env
npx prisma generate
npx prisma migrate deploy   # production
# atau: npx prisma migrate dev --name init
npx prisma db seed
```

### e. Jalankan API
```bash
npm run dev     # development
npm start       # production — API saja
```

Default: `http://localhost:4000` — prefix `/api` dan `/api/v1/...`.
Swagger: `/api/docs`. Socket.IO di port yang sama.

**Hostinger build command (wajib):**
```bash
npm ci --omit=dev && npx prisma generate
```

### f. Background jobs

**Shared hosting** — Cron + CLI (bukan process scheduler 24 jam):

```bash
npm run jobs:frequent   # expire opportunity + invitation
npm run jobs:daily      # membership trim, stats, cleanup, fraud
npm run jobs:once -- expireMemberships
```

Detail: `docs/deployment-guide.md`.

**VPS / Docker:** `npm run scheduler` + optional Redis workers.

### g. Membership dev (non-production)
```bash
curl -X POST http://localhost:4000/api/v1/membership/dev-activate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "durationDays": 30 }'
```
Diblokir jika `NODE_ENV=production`.

---

## 3. Opportunity (Need / Offer)

| Status akun | NEED ACTIVE | OFFER ACTIVE |
|-------------|------------:|-------------:|
| Non-member | 1 | 1 |
| Member aktif | 20 | 20 |
| Membership expired | keep 1 terakhir | keep 1 terakhir |

Error quota: `OPPORTUNITY_QUOTA_EXCEEDED` (dan varian Need/Offer).

Konstanta: `src/shared/constants.js`.

Self-match (Need & Offer pihak yang sama) dicegah di Matching Engine.

---

## 4. Chat vs Invitation

| Jalur | Fungsi | Kode |
|-------|--------|------|
| **Invitation** | Formal → Accept → Deal | ✅ |
| **Chat Opportunity** (`NEED` / `OFFER`) | Cepat, tanpa membership | ✅ |
| **Cold DM** (`PROFILE`) | Recipient harus member aktif | ✅ |
| **Anti-spam** | 5/30 conv baru/hari (WIB); max 20 pesan unreplied/jam | ✅ Redis + Prisma fallback |
| **Report dari chat** | `POST /chat/conversations/:id/report` | ✅ |

### Socket.IO
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { auth: { token: supabaseAccessToken } });
socket.on('message:new', (message) => {});
socket.emit('message:send', { conversationId, content: 'Halo!' }, (ack) => {});
```
Upload media: `POST /api/v1/chat/conversations/:id/messages` (multipart).

---

## 5. Payment (Membership & Boost)

| Produk | Checkout | Aktivasi |
|--------|----------|----------|
| Membership | `POST /membership/checkout` + Snap URL | Webhook → `ACTIVE` (extend jika masih aktif) |
| Boost FREE | `POST /boosts/:opportunityId/checkout` | Langsung PAID |
| Boost berbayar | Checkout → Snap | Webhook order `BOOST-{id}` → PAID |

Keamanan webhook:
- Verifikasi signature SHA-512 Midtrans
- Cek `gross_amount` vs amount DB
- Claim atomik `PENDING` (anti double-activate)
- Order tidak dikenal (signature valid) → HTTP 200 ACK (stop retry)

Ranking **hanya** memakai boost dengan `paymentStatus === PAID` dan belum expired.

---

## 6. Autentikasi

Client: Supabase Auth. Backend:
1. `Authorization: Bearer <supabase_access_token>`
2. Verifikasi token
3. Sinkron `users` + `profiles`

```
POST /api/v1/auth/register
GET  /api/v1/auth/me
```

Google OAuth: aktifkan di Supabase dashboard (backend tidak berubah).

---

## 7. Ringkasan endpoint utama

| Modul | Endpoint (prefix `/api/v1`) |
|-------|-----------------------------|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `GET /auth/me` |
| Profiles / Parties | CRUD + portfolio |
| Opportunities | CRUD, close, search/filter |
| Matching | `GET /matching/:opportunityId/run` |
| Boosts | `GET /boosts/plans`, `POST /boosts/:opportunityId/checkout` |
| Invitations / Deals | create, respond, patch status |
| Chat | conversations, messages, read, **report** |
| Membership | plans, checkout, webhook, transactions |
| Reports | `POST /reports` |
| Admin | `/admin/*` |
| Content (CMS) | `/content/pages/:slug`, `/content/faq` |
| Intent | `POST /intent` (rate-limited) |

---

## 8. Matching & Ranking

Hard filter: tipe berlawanan, `ACTIVE`, kategori, visibility, **bukan self-match** / related party.

Match score (0–100): capability, location, budget, tags, text, priority.

Final ranking: match + reputation + response + completion + activity + verification + **boost PAID** − penalty.
Bobot: `RANKING_WEIGHT_*` di env.

---

## 9. Deal state machine

```
Invitation: PENDING → ACCEPTED | REJECTED | EXPIRED
ACCEPTED → Deal(NEGOTIATION)

Deal:
  NEGOTIATION → DEAL | CANCELLED | EXPIRED
  DEAL → IN_PROGRESS | CANCELLED | EXPIRED
  IN_PROGRESS → COMPLETED | CANCELLED
```

Sebelum `COMPLETED`: `runFraudChecks` dapat memblokir (409) atau mencatat `FraudFlag`.

---

## 10. Keamanan

| Kontrol | Detail |
|---------|--------|
| Auth | Supabase JWT + `requireAuth` / `requireVerifiedSession` |
| RBAC | `requireRole('ADMIN')` |
| CORS | Whitelist origin (`ALLOWED_ORIGINS` / `CLIENT_URL`) |
| Input | Zod di route sensitif |
| Upload | Multer + Cloudinary, batas ukuran |
| Rate limit global | 300 / 15 menit (default) |
| Rate limit intent | 40 / 15 menit |
| Rate limit webhook | 120 / menit |
| Rate limit report | 10 / jam + max 1 PENDING/target/hari |
| Chat anti-spam | Conv baru/hari + unreplied burst |
| Payment webhook | Signature + amount + atomic claim |
| Account | Suspend/ban ditegakkan di auth middleware |

Env throttle (opsional): `THROTTLE_MAX`, `THROTTLE_INTENT_MAX`, `THROTTLE_WEBHOOK_MAX`,
`CHAT_NEW_CONV_MAX_FREE`, `CHAT_NEW_CONV_MAX_MEMBER`, `CHAT_UNREPLIED_BURST_MAX`.

---

## 11. Roadmap pasca-MVP (backend)

### Selesai di kode MVP
- [x] Chat policy FR-16 / FR-17 + anti-spam + report dari room
- [x] Midtrans Membership + Boost (adapter, webhook aman)
- [x] Admin API + CMS + reports
- [x] Fraud detection rule-based + review endpoint

### Go-live checklist (ops)
- [ ] Production `DATABASE_URL` / `DIRECT_URL` sehat → `GET /api/v1/health` = 200
- [ ] `MIDTRANS_*` production + notification URL
- [ ] Seed + publish halaman **Syarat & Ketentuan** / **Privasi**
- [ ] Cron Hostinger path version aktif
- [ ] (Opsional) Google OAuth Supabase

### Backlog produk
- [ ] Notifikasi Email / WhatsApp (FR-12) — mailer skeleton sudah ada
- [ ] Escrow payout + dispute mediation penuh
- [ ] Optimasi matching skala besar
- [ ] Integration / E2E tests

---

## 12. Background jobs

CLI + `scheduler.js` sudah ada. Di Hostinger pasang cron sesuai **`docs/deployment-guide.md`**
(path `hbuilds/versions/...` berubah tiap redeploy — update cron).

---

## Lisensi & kontribusi

Lihat `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
