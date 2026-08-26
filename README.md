# Business Matching Bridge — Engine

Backend engine untuk platform *business matching* sesuai alur:

```
Register/Login → Verification → Opportunity → Boost → Matching → Ranking
→ User memilih hasil → Invitation → Accept/Reject → Negotiation → Deal
→ In Progress → Completed / Cancelled / Expired
```

Stack: **Node.js + Express**, **Prisma ORM**, **Zod** (validation), **Cloudinary** (file storage),
**Supabase** (Postgres DB + Auth).

## 1. Struktur Project

```
prisma/schema.prisma        # semua model (User, Party, Opportunity, Match, Invitation, Deal, dst)
prisma/seed.js               # seed Boost Plans + kategori dasar
src/config/                  # env, prisma client, cloudinary, supabase
src/middlewares/             # auth (verify Supabase token), validate (zod), upload (multer), error
src/utils/                   # apiError, apiResponse, asyncHandler, cloudinaryUpload
src/validations/             # zod schema per modul
src/modules/
  auth/          -> STEP 1: register/login sync dari Supabase Auth
  profile/       -> profile CRUD
  verification/  -> STEP 2: upload dokumen (KTP/NIB/NPWP/dll) + status UNVERIFIED->PENDING->VERIFIED/REJECTED
  opportunity/   -> STEP 3: create Need/Offer
  boost/         -> STEP 4: aktivasi paket FREE/BASIC/PREMIUM/VIP
  matching/       -> STEP 5+6: matching engine (hard filter + scoring) & ranking engine
  ranking/       -> ranking.service.js (composite score) + partyStats.service.js (reputasi dsb)
  invitation/    -> STEP 8: invitation + deal state machine (negotiation->deal->in_progress->completed)
  review/        -> rating pasca-deal, feed ke reputationScore
  notification/  -> notifikasi in-app
```

## 2. Setup

### a. Install dependencies
```bash
npm install
```

### b. Buat project Supabase
1. Buat project baru di https://supabase.com
2. Ambil connection string di **Settings > Database > Connection string (URI)** → isi `DATABASE_URL` & `DIRECT_URL` di `.env`
3. Ambil `SUPABASE_URL`, `anon key`, `service_role key`, `JWT secret` di **Settings > API** → isi ke `.env`
4. Auth: aktifkan provider yang dibutuhkan (Email/Password, Google, dll) di **Authentication > Providers**

### c. Buat akun Cloudinary
1. Daftar di https://cloudinary.com
2. Ambil `Cloud name`, `API Key`, `API Secret` dari dashboard → isi ke `.env`

### d. Copy env & migrate
```bash
cp .env.example .env
# isi semua value di .env

npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed   # isi Boost Plans + kategori dasar
```

### e. Jalankan server
```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server default di `http://localhost:4000`, semua endpoint di-prefix `/api`.
Swagger UI (masih minim spec) tersedia di `http://localhost:4000/api/docs`.
**Chat WebSocket (Socket.IO) menumpang di port yang sama** — lihat bagian Chat di bawah.

### f. Aktifkan Google OAuth (MVP Phase 2)

Tidak perlu kode tambahan — backend ini cuma memverifikasi Supabase access token,
tidak peduli provider aslinya. Cukup aktifkan di dashboard Supabase:
1. **Authentication → Providers → Google** → aktifkan, isi Client ID & Secret dari Google Cloud Console
2. Client (frontend) memanggil `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Access token hasilnya dipakai sama persis seperti login email (`Authorization: Bearer <token>`)

Verifikasi email & lupa password juga bawaan Supabase Auth (Authentication → Email Templates),
tidak perlu endpoint tambahan di backend ini.

### g. Chat / WebSocket (MVP Phase 8)

Client connect ke Socket.IO dengan Supabase access token:
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { auth: { token: supabaseAccessToken } });

socket.on('message:new', (message) => { /* render pesan baru */ });
socket.on('typing:start', ({ conversationId, fromProfileId }) => { /* tampilkan indikator */ });
socket.on('conversation:read', ({ conversationId, readBy }) => { /* update centang biru */ });

socket.emit('message:send', { conversationId, content: 'Halo!' }, (ack) => {
  if (!ack.ok) console.error(ack.message);
});
socket.emit('typing:start', { conversationId });
socket.emit('conversation:read', { conversationId });
```

Untuk kirim gambar/attachment (butuh multipart, tidak lewat WS), pakai REST:
`POST /api/v1/chat/conversations/:id/messages` dengan field `file` + `type=IMAGE`/`ATTACHMENT`.

**Business rule penting:** memulai conversation BARU (`POST /chat/conversations`) dengan
`originType: "OFFER"` atau `"PROFILE"` akan ditolak (403) kalau recipient belum punya
membership aktif — ditegakkan di `ConversationPolicy` (`src/modules/chat/chat.policy.js`),
bukan hardcode di service. `originType: "NEED"` selalu gratis, tidak ada gating sama sekali.
Conversation yang sudah ada tetap bisa dilanjutkan meski membership recipient berakhir.

Untuk testing tanpa payment gateway sungguhan (Midtrans sandbox butuh kredensial asli),
aktifkan membership manual dulu lewat domain Membership:
```bash
curl -X POST http://localhost:4000/api/v1/membership/dev-activate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "durationDays": 30 }'
```
Endpoint ini **otomatis diblokir kalau `NODE_ENV=production`** (lihat `membership.controller.js`)
— di production, satu-satunya cara mengaktifkan membership adalah lewat
`POST /membership/checkout` (dapat `paymentUrl` dari Midtrans Snap) diikuti pembayaran
sungguhan, yang mengaktifkan membership via `POST /membership/webhook/midtrans`.
Swagger UI (masih minim spec) tersedia di `http://localhost:4000/api/docs`.

### f. (Opsional) Jalankan background services

Scheduler & worker berjalan sebagai proses terpisah — tidak wajib untuk API dasar berfungsi:

```bash
npm run scheduler            # cron: expire opportunity/invitation, recompute stats, cleanup notif
npm run worker:party-stats   # BullMQ worker — butuh REDIS_URL aktif
npm run worker:notification  # BullMQ worker — butuh REDIS_URL aktif
```

Kalau Redis belum dipasang, API tetap jalan normal (cache & queue fail-safe/no-op —
lihat `src/core/cache.js` dan `src/core/queue.js`).

## 3. Alur Autentikasi

Auth **sepenuhnya ditangani Supabase Auth** di sisi client (pakai `@supabase/supabase-js`,
sign up / sign in / OAuth). Backend ini **tidak** menyimpan password — backend hanya:

1. Menerima `Authorization: Bearer <supabase_access_token>`
2. Verifikasi token ke Supabase (`supabase.auth.getUser(token)`)
3. Sinkronkan ke tabel lokal `users` + `profiles` (dan opsional `parties`, `business_roles`)

```
POST /api/auth/register   (Bearer token wajib) -> buat Profile + Party + Role + Capability
GET  /api/auth/me         (Bearer token wajib) -> ambil profile yang sedang login
```

## 4. Ringkasan Endpoint per Step

| Step | Modul | Endpoint |
|---|---|---|
| 1. Register/Login | auth | `POST /api/auth/register`, `GET /api/auth/me` |
| 2. Verification | verification-documents | `POST /api/verification-documents` (multipart `file`), `GET /api/verification-documents/me`, `PATCH /api/verification-documents/:id/review` (admin) |
| 3. Opportunity | opportunities | `POST /api/opportunities`, `GET /api/opportunities`, `GET /api/opportunities/:id`, `PATCH /api/opportunities/:id`, `POST /api/opportunities/:id/media` |
| 4. Boost | boosts | `GET /api/boosts/plans`, `POST /api/boosts/:opportunityId/activate` |
| 5+6. Matching + Ranking | matching | `GET /api/matching/:opportunityId/run?limit=10` |
| 7. Hasil (detail party) | profiles / reviews | `GET /api/profiles/:id`, `GET /api/reviews/profile/:profileId` |
| 8. Invitation | invitations | `POST /api/invitations`, `GET /api/invitations/me`, `PATCH /api/invitations/:id/respond` |
| Negotiation→Deal | invitations (deals) | `GET /api/invitations/deals/me`, `PATCH /api/invitations/deals/:id` |
| Review | reviews | `POST /api/reviews/deals/:dealId` |
| Notification | notifications | `GET /api/notifications/me`, `PATCH /api/notifications/:id/read` |

## 5. Matching Engine — Logika

**Hard Filter** (candidate dibuang kalau gagal salah satu):
- Tipe berlawanan (NEED butuh OFFER, dan sebaliknya)
- Status kandidat harus `ACTIVE`
- Kategori sama (kalau sumber punya kategori)
- Visibility: `PRIVATE` selalu dibuang, `VERIFIED_ONLY` hanya lolos kalau kedua pihak `VERIFIED`

**Scoring** (`src/modules/matching/matching.service.js`, hasil 0–100):
```
matchScore = 100 × (
    0.30 × capabilityMatch   (Jaccard capability set)
  + 0.15 × location           (exact/partial match)
  + 0.20 × budget              (overlap rentang budget)
  + 0.15 × tags                 (Jaccard tag set)
  + 0.15 × textSimilarity     (Jaccard token judul+deskripsi)
  + 0.05 × priority
)
```

## 6. Ranking Engine — Logika

`src/modules/ranking/ranking.service.js`, digabung dengan `partyStats.service.js`
(reputationScore dari rata-rata review, responseScore dari rasio invitation yang direspon,
completionScore dari rasio deal completed, activityScore dari opportunity 30 hari terakhir):

```
finalScore = matchScore        × W_match
           + reputationScore   × W_reputation
           + responseScore      × W_response
           + completionScore    × W_completion
           + activityScore      × W_activity
           + verificationScore  × W_verification
           + premiumBoost       × W_boost
           - cancelPenalty
           - expiredPenalty
```

Bobot (`W_*`) diatur lewat env `RANKING_WEIGHT_*` di `.env.example`, total default = 1.0.

## 7. Invitation → Deal State Machine

```
Invitation: PENDING -> ACCEPTED | REJECTED | EXPIRED

Saat ACCEPTED -> otomatis buat Deal(status = NEGOTIATION)

Deal:
  NEGOTIATION -> DEAL | CANCELLED | EXPIRED
  DEAL        -> IN_PROGRESS | CANCELLED | EXPIRED
  IN_PROGRESS -> COMPLETED | CANCELLED
  COMPLETED / CANCELLED / EXPIRED -> final (tidak bisa transisi lagi)
```

Setiap kali Deal masuk status final, `partyStats.service.js` dipanggil ulang supaya
reputationScore/completionScore ter-update untuk matching berikutnya.

## 8. Catatan Keamanan

- Semua endpoint yang mengubah data mewajibkan `requireAuth` (verifikasi token Supabase).
- Kepemilikan resource (`Party`, `Opportunity`, `Deal`) selalu dicek terhadap `req.profile.id`
  sebelum operasi tulis diizinkan.
- Role `ADMIN` (tabel `business_roles`) dibutuhkan untuk approve/reject dokumen verifikasi.
- File upload dibatasi 10MB, tipe: jpg/png/webp/pdf (`src/middlewares/upload.middleware.js`).
- Rate limit global 300 req / 15 menit per IP (`express-rate-limit`).

## 9. Next Steps (opsional, belum termasuk di kode ini)

- Payment gateway real (Midtrans/Xendit) untuk `OpportunityBoost.paymentStatus`
- Realtime notification (Supabase Realtime / WebSocket) menggantikan polling `/notifications/me`
- Background job (cron) untuk auto-expire Opportunity/Invitation yang lewat `expiresAt`
- Endpoint admin untuk kelola `Category` & `Capability` master data
