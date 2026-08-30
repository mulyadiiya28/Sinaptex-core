# Sinaptex — API Engine

Backend engine untuk platform *business matching* **Sinaptex**.

Stack: **Node.js + Express**, **Prisma ORM**, **Zod**, **Cloudinary**, **Supabase** (Postgres + Auth),
**Socket.IO** (chat), **node-cron** / CLI jobs (scheduler).

## Alur utama (revisi produk)

```
Register/Login → Verification → Opportunity (Need / Offer)
  → Boost → Matching → Ranking → User pilih hasil
       ├─ Chat cepat dari Opportunity (tanpa wajib Invitation)     ← FR-16, policy kode belum final
       └─ Invitation formal → Accept → Deal → … → Completed
```

**Invitation bukan satu-satunya jalan komunikasi.** Invitation = jalur formal ke Deal.
Chat dari Opportunity dirancang paralel (lihat `docs/product-decisions-offer-chat.md`).

Dokumen produk / FR:
- `docs/product-decisions-offer-chat.md` — keputusan Need, Offer, membership, chat
- `docs/functional-requirement.md` — FR-15 / FR-16 / FR-17
- `docs/flowchart.md`, `docs/state-machines.md`
- `docs/deployment-guide.md` — deploy + **cron Hostinger**

---

## Status fitur (singkat)

| Area | Status |
|------|--------|
| Auth, verification, matching, ranking, invitation, deal | ✅ |
| Opportunity: Need & Offer untuk non-member | 🔄 aturan produk baru |
| Non-member: max **1 ACTIVE Need + 1 ACTIVE Offer** | 🔄 aturan produk baru |
| Member aktif: max **20 ACTIVE Need + 20 ACTIVE Offer** | 🔄 aturan produk baru |
| Membership expire → sisa **1 posting terakhir** untuk masing-masing tipe | 🔄 aturan produk baru |
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
  expireMemberships.job.js   # membership expire + trim posting
  expireOpportunities.job.js
  …
src/modules/
  auth/  profile/  verification/
  opportunity/   # Need & Offer + quota berdasarkan status membership
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
npm run jobs:daily      # membership + trim posting, stats, cleanup, fraud
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

Aturan produk saat ini:

| Status akun | NEED | OFFER |
|------|------:|------:|
| **Non-member** | Maks. **1 ACTIVE** | Maks. **1 ACTIVE** |
| **Member aktif** | Maks. **20 ACTIVE** | Maks. **20 ACTIVE** |
| **Membership expired / tidak aktif** | Pertahankan **1 posting terakhir** | Pertahankan **1 posting terakhir** |

### Aturan penting

1. **Need dan Offer sama-sama boleh dibuat oleh non-member.** Membership tidak lagi menjadi syarat untuk membuat Offer.
2. Non-member dibatasi maksimal **1 Need ACTIVE + 1 Offer ACTIVE**.
3. Member aktif dibatasi maksimal **20 Need ACTIVE + 20 Offer ACTIVE**.
4. Quota dihitung berdasarkan posting berstatus `ACTIVE`, bukan jumlah seluruh history posting.
5. Ketika membership berakhir, sistem melakukan trim dan hanya mempertahankan **1 posting terakhir untuk Need dan 1 posting terakhir untuk Offer**. Posting lain ditutup (`CLOSED`) dan tidak boleh tetap aktif.
6. Posting `CLOSED`, `EXPIRED`, atau `CANCELLED` tidak dihitung sebagai quota ACTIVE.
7. Need dan Offer dari pemilik/party yang sama **tidak boleh menghasilkan self-match**.
8. User yang memiliki Need dan Offer secara bersamaan **tetap diperbolehkan** selama masing-masing quota terpenuhi.

Error quota:
- `OPPORTUNITY_QUOTA_EXCEEDED`

Konstanta yang direkomendasikan di `src/shared/constants.js`:
- `MAX_ACTIVE_FREE_NEEDS = 1`
- `MAX_ACTIVE_FREE_OFFERS = 1`
- `MAX_ACTIVE_MEMBER_NEEDS = 20`
- `MAX_ACTIVE_MEMBER_OFFERS = 20`
- `POSTINGS_KEPT_AFTER_MEMBERSHIP_EXPIRE = 1`

> Catatan implementasi: README ini mendokumentasikan **aturan produk baru**. Kode opportunity dan job membership harus diaudit agar implementasinya benar-benar sama dengan aturan ini.

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

Hard filter: tipe berlawanan, `ACTIVE`, kategori, visibility, dan **bukan self-match**.

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

- [ ] Audit & implementasi quota baru: **1 Need + 1 Offer non-member; 20 Need + 20 Offer member**
- [ ] Audit & implementasi membership expiry: **sisa 1 posting terakhir untuk Need dan Offer**
- [ ] **Self-match prevention** pada matching engine
- [ ] **FR-16** — longgarkan `chat.policy.js` + rate limit anti-spam
- [ ] Selaraskan FAQ seed yang masih menyebut chat butuh membership penerima
- [ ] Payment gateway penuh untuk boost (selain membership Midtrans)
- [ ] Notifikasi email/WhatsApp

Scheduler opportunity/invitation/membership: **sudah ada** (CLI + `scheduler.js`); di shared host pasang **cron** sesuai `docs/deployment-guide.md`.
