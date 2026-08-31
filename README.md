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
| Auth, verification, matching, ranking, invitation, deal | ✅ Selesai |
| Opportunity Quota: Non-member (1 Need + 1 Offer) & Member (20 Need + 20 Offer) | ✅ Selesai |
| Expiration Job: Trim sisa 1 posting (Need & Offer) saat membership expired | ✅ Selesai |
| CLI & Background jobs (`run-once.js`, `expireMemberships.job.js`) | ✅ Selesai |
| Chat dari Opportunity tanpa gate membership + Anti-spam (FR-16) | ✅ Selesai |
| Jalur Chat Mandiri / Non-blocking Invitation (FR-17) | ✅ Selesai |
| Matching Engine Self-Match Prevention & Fraud Guard (Pencegahan sirkular) | ✅ Selesai |
| Payment Gateway Integration (Midtrans / Xendit untuk Boost & Membership) | ⬜ Prioritas 2 |
| Multi-channel Notifications (Email & WhatsApp Integration) (FR-12) | ⬜ Prioritas 2 |
| Escrow & Pending Transaction Protection (Rekber B2B / Deal Protection) | ⬜ Prioritas 3 (Desain Siap) |
| Admin Moderation & Fraud Flag Review Dashboard API (FR-13) | ⬜ Prioritas 4 |

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

## 10. Daftar Modul MVP yang Wajib Diselesaikan (Roadmap Pengembangan)

Berikut adalah modul-modul MVP prioritas yang wajib diselesaikan pada tahap pengembangan berikutnya agar platform siap diluncurkan secara komersial dan operasional:

### 🚀 Prioritas 1: Komunikasi & Kebijakan Chat (FR-16 & FR-17)
*Tujuan: Membuka potensi interaksi antar pebisnis tanpa friksi berlebih namun tetap terlindungi dari spam.*
- [x] **1.1 Relaksasi Kebijakan Chat (`chat.policy.js`)**:
  - Mengizinkan chat langsung dari konteks Opportunity (`originType: NEED` atau `OFFER` dengan `opportunityId` valid) **tanpa kewajiban membership**.
  - Mengizinkan kelanjutan percakapan (reply pesan) pada percakapan yang sudah ada untuk semua user.
  - Mempertahankan pembatasan selektif untuk *Cold DM* (`originType: PROFILE` tanpa kartu opportunity).
- [ ] **1.2 Proteksi Anti-Spam & Rate Limiting Chat**:
  - Batasan pembuatan percakapan baru per hari (maks. 5 conversation baru/hari untuk non-member, 30/hari untuk member).
  - Limit pesan bertubi-tubi sebelum ada balasan pertama dari penerima (maks. 20 pesan/jam).
  - Integrasi fitur Report/Block user yang mengganggu langsung dari chat room.
- [x] **1.3 Pemisahan Alur Chat vs Invitation Formal (FR-17)**:
  - User dapat chat langsung dari kartu Opportunity tanpa harus menunggu Invitation di-accept.
  - Invitation tetap berfungsi khusus sebagai pintu formal menuju pembuatan `Deal (NEGOTIATION)`.
  - Sinkronisasi teks/seed FAQ agar tidak lagi menyebutkan bahwa chat memerlukan membership penerima.

---

### 💳 Prioritas 2: Monetisasi & Payment Gateway
*Tujuan: Mengotomatisasi proses pembayaran langganan Membership dan paket Opportunity Boost.*
- [ ] **2.1 Integrasi Payment Gateway (Midtrans / Xendit)**:
  - Implementasi alur checkout pembayaran untuk **Paket Membership** (Bulanan/Tahunan) dan **Paket Boost** (Basic/Premium/VIP).
  - Penanganan webhook notifikasi pembayaran dengan verifikasi signature & handling idempotency (`idempotencyKey`).
- [ ] **2.2 Siklus Transaksi & Aktivasi Otomatis**:
  - Otomatis mengubah status membership/boost menjadi `ACTIVE` seketika pembayaran sukses.
  - Penanganan status pembayaran kadaluarsa (`EXPIRED`) atau dibatalkan (`CANCELLED`).
  - Pencatatan log invoice dan histori transaksi di level Profile/Party.

---

### 🔔 Prioritas 3: Multi-Channel Notifications (FR-12)
*Tujuan: Memastikan user tidak melewatkan match penting, pesan masuk, atau penawaran deal saat sedang offline.*
- [ ] **3.1 External Notification Dispatcher (Email & WhatsApp)**:
  - Integrasi provider email transaksional (Resend / SendGrid / SMTP).
  - Integrasi gateway WhatsApp bisnis (Fonnte / Twilio / Waba) untuk alert instan.
- [ ] **3.2 Trigger Event Notifikasi Kritis**:
  - Notifikasi saat menerima **Invitation baru** atau **Deal status update**.
  - Notifikasi pesan chat baru jika user penerima sedang offline/tidak membuka WebSocket selama >5 menit.
  - Pengingat masa aktif membership (H-3 dan H-1 sebelum membership berakhir).
  - Notifikasi hasil review verifikasi dokumen oleh admin (Approved/Rejected).

---

### 🛡️ Prioritas 4: Escrow & Pending Transaction Protection (Rekber / Perlindungan Transaksi B2B)
*Tujuan: Menjamin keamanan transaksi antar pihak yang belum saling kenal dengan menahan dana pembeli hingga pekerjaan/barang selesai diserahterimakan.*

#### A. Alur Arsitektur & Siklus Hidup Transaksi (State Machine)
```
[Buyer & Seller Sepakat Deal]
             │
             ▼
[1. Buat Kontrak Transaksi Escrow] ───► Total Nilai Deal + Fee Platform
             │
             ▼
[2. Buyer Bayar ke Virtual Account Escrow] (Payment Gateway Midtrans/Xendit)
             │
             ▼
[Dana Masuk & Status: FUNDS_HELD] ───► Seller Notified "Dana Aman, Mulai Eksekusi"
             │
             ▼
[3. Seller Kirim Barang / Selesaikan Jasa] ───► Upload Resi / Bukti Serah Terima (DELIVERED)
             │
             ▼
[4. Buyer Review Hasil] ─── (Batas Waktu Auto-Release: 3-7 Hari)
             │
     ┌───────┴────────────────────────┐
     ▼                                ▼
[Buyer Approve]                [Buyer Ajukan Komplain]
     │                                │
     ▼                                ▼
[5. Dana Dicairkan (RELEASED)]  [Status: DISPUTED]
  • Fee Platform dipotong          • Admin Mediator Masuk
  • Dana Payout ke Seller          • Mediasi / Refund / Partial Release
```

#### B. Rincian Status Escrow (Status Lifecycle)
1. **`AWAITING_PAYMENT`**: Kontrak escrow terbuat, invoice/VA diterbitkan, menunggu pembayaran buyer.
2. **`FUNDS_HELD`**: Pembayaran terverifikasi gateway, dana tertahan di rekening penampung aman, seller mulai bekerja.
3. **`IN_PROGRESS / DELIVERED`**: Seller menandai pekerjaan selesai / barang terkirim beserta bukti serah terima.
4. **`RELEASED / COMPLETED`**: Buyer menyetujui hasil, dana diteruskan ke saldo/rekening seller setelah dipotong fee platform.
5. **`AUTO_RELEASED`**: Dana otomatis cair ke seller jika buyer tidak memberikan konfirmasi/komplain dalam batas waktu perlindungan (misal 5 hari).
6. **`DISPUTED`**: Sengketa dibuka jika barang/jasa cacat atau tidak sesuai; dana dibekukan sementara menunggu keputusan mediator admin.
7. **`REFUNDED / PARTIAL_REFUNDED`**: Dana dikembalikan sebagian atau penuh ke buyer berdasarkan keputusan sengketa.

#### C. Checklist Modul Escrow:
- [ ] **4.1 Skema Data Escrow Contract & Milestone (`prisma/schema.prisma`)**:
  - Model `EscrowTransaction`, `EscrowMilestone`, `EscrowDispute`, dan `EscrowPayoutAccount`.
- [ ] **4.2 Service Layer & State Engine (`escrow.service.js`)**:
  - Validasi transisi state, perhitungan *platform fee*, dan pencegahan *double-release*.
- [ ] **4.3 Dispute & Admin Mediation System**:
  - Endpoint pengajuan sengketa beserta unggah bukti percakapan/foto kondisi barang.
  - Endpoint keputusan admin untuk mediasi (*Release to Seller*, *Full Refund to Buyer*, atau *Partial Split*).
- [ ] **4.4 Auto-Release Cron Worker (`autoReleaseEscrow.job.js`)**:
  - Background job otomatis merilis dana transaksi berstatus `DELIVERED` yang melampaui batas waktu review.
- [ ] **4.5 Payout / Disbursement Integration**:
  - Penyaluran dana aman (*Disbursement*) ke rekening bank/e-wallet seller setelah deal sukses.

---

### ⚖️ Prioritas 5: Admin Moderasi & Fraud Review API (FR-13)
*Tujuan: Memberikan kendali penuh bagi tim operasional untuk memverifikasi dokumen bisnis dan menangani indikasi fraud.*
- [ ] **5.1 Verifikasi Dokumen Legal Bisnis (FR-02)**:
  - Endpoint list pengajuan dokumen verifikasi yang berstatus `PENDING`.
  - Aksi verifikasi: `APPROVE` (memberikan badge & poin reputasi) atau `REJECT` (dengan alasan spesifik).
- [ ] **5.2 Dashboard Moderasi & FraudFlag (FR-10)**:
  - Endpoint daftar `FraudFlag` (`PENDING_REVIEW`) yang terdeteksi otomatis oleh Fraud Engine.
  - Aksi penanganan fraud: `CONFIRMED` (blokir deal/suspend party) atau `DISMISSED` (abaikan jika false positive).
  - Endpoint suspend/ban user atau party yang melanggar ketentuan platform.

---

### 🔍 Prioritas 6: Matching Engine Self-Match Prevention & Optimasi
*Tujuan: Menghindari circular matching dan meningkatkan relevansi penemuan mitra bisnis.*
- [x] **6.1 Pencegahan Self-Match Total**:
  - Memastikan pencarian matching mengecualikan opportunity milik Profile yang sama, meskipun dibuat menggunakan Party bisnis yang berbeda.
- [ ] **6.2 Penyempurnaan Filter & Kategori**:
  - Penyelarasan kategori induk dan sub-kategori pada algoritma scoring.
  - Optimasi query matching untuk menangani volume data yang lebih besar secara efisien.

---

## 11. Background Jobs & Scheduler

Scheduler opportunity/invitation/membership: **sudah ada** (CLI + `scheduler.js`); di shared host pasang **cron** sesuai `docs/deployment-guide.md`.

