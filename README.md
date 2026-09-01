# Sinaptex — API Engine

Backend engine untuk platform *business matching* **Sinaptex**.

Stack: **Node.js + Express**, **Prisma ORM**, **Zod**, **Cloudinary**, **Supabase** (Postgres + Auth),
**Socket.IO** (chat + notifikasi), **Midtrans Snap** (payment adapter), **Redis/Upstash** (cache + rate limit),
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
- `docs/api/websocket.md` — kontrak event Socket.IO
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
| Health: DB + Redis/cache + **socket stats** | ✅ |
| Notifikasi in-app + push real-time (`notification:new`) | ✅ |
| Admin API + CMS + chat rate-limit settings | ✅ |
| Konten legal seed (S&K / Privasi / Kontak) PUBLISHED | ✅ kerangka; review hukum ops |
| WebSocket: batas koneksi / profile, heartbeat, kompresi, metrik | ✅ |
| **Production DB + REDIS_URL + Midtrans prod** | 🔴 blocker ops |
| Google OAuth | ⬜ Supabase dashboard |
| Escrow hold/confirm/release/refund/dispute | 🟡 modul ada; payout bank lanjut |
| Email / WhatsApp production | ⬜ post-MVP |

---

## MVP backlog — apa yang perlu dikerjakan

Prioritas soft-launch: **Security → Performa → Ops → Fitur sisa**.  
Legenda: ✅ selesai · 🟡 sebagian / perlu hardening · 🔴 belum / blocker · ⬜ sengaja ditunda (post-MVP)

Detail go-live ops juga ada di **`docs/GO_LIVE.md`**.

### A. Security (wajib diprioritaskan)

| Item | Status | Catatan |
|------|--------|---------|
| CORS whitelist (`CLIENT_URL` / `ALLOWED_ORIGINS`) | 🟡 | Kode siap; **wajib diisi domain production** |
| Supabase JWT di REST + handshake Socket.IO | ✅ | |
| Room socket `profile:{id}` di-set server-side | ✅ | Client tidak boleh pilih room sendiri |
| Authz chat (participant + policy) | ✅ | |
| Rate limit HTTP (global / intent / webhook / report) | ✅ | |
| Chat anti-spam (conv/hari + unreplied burst) | ✅ | |
| Batas koneksi WS per profile (kick oldest) | ✅ | Env: `WS_MAX_CONNECTIONS_PER_PROFILE` |
| `maxHttpBufferSize` + Origin check WS | ✅ | |
| **Revalidasi JWT / cek ban pada koneksi WS panjang** | 🔴 | Session tetap hidup setelah revoke/ban sampai disconnect — **penting MVP** |
| **Rate limit event WS** (`message:send`, `typing:*`) | 🔴 | Anti flood lewat socket, bukan hanya REST — **penting MVP** |
| **Error generik ke client di production** (jangan `err.message` mentah) | 🟡 | Masih banyak `err.message` di handler socket — hardening |
| Tolak user `BANNED` / `SUSPENDED` di handshake WS | 🔴 | Selaras policy REST |
| Webhook Midtrans signature + amount check | ✅ kode | Uji di sandbox/prod masih ops |
| Secrets tidak di Git; rotasi jika pernah bocor | 🔴 ops | Redis/Midtrans/Supabase |
| WSS (TLS) di production | 🔴 ops | Jangan `ws://` publik |
| Review hukum S&K / Privasi | 🟡 ops | Seed ada; claim compliance penuh butuh review |

### B. Performa

| Item | Status | Catatan |
|------|--------|---------|
| Redis cache untuk plans / CMS / matching / membership | ✅ kode | **`REDIS_URL` production sering masih kosong** → 🔴 ops |
| DB pooler (`pgbouncer=true` pada `DATABASE_URL`) | 🔴 ops | Cegah connection exhaustion |
| Heartbeat WS (`pingInterval` / `pingTimeout`) | ✅ | Env: `WS_PING_*` |
| Kompresi WS `perMessageDeflate` + threshold | ✅ | Env: `WS_PER_MESSAGE_DEFLATE*` |
| Metrik rasio kompresi + disconnect reasons di health | ✅ | `GET /api/v1/health` → `socket` |
| **Proxy `proxy_read_timeout` ≥ 90s** (selaras heartbeat) | 🔴 ops | Salah timeout → reconnect storm |
| Payload emit chat/notifikasi tetap ramping | 🟡 | Audit jika ada over-fetch relasi besar |
| Indeks / query path marketplace + matching | 🟡 | Ukur latency di staging; optimasi bila lambat |
| Socket.IO Redis adapter (multi-instance) | ⬜ | Baru perlu saat >1 proses Node |

### C. Operasional production (blocker soft-launch)

| Item | Status | Catatan |
|------|--------|---------|
| `DATABASE_URL` + `DIRECT_URL` production sehat | 🔴 | Health → `database: ok` |
| `REDIS_URL` (Upstash `rediss://…`) + restart | 🔴 | Health → `redis: ok`, `cache: ok` |
| `npx prisma migrate deploy` + seed (plans, kategori, legal) | 🔴 | |
| Midtrans production keys + webhook URL | 🔴 | `MIDTRANS_IS_PRODUCTION=true` |
| Cron Hostinger: `jobs:frequent` + `jobs:daily` | 🔴 | Path version berubah tiap deploy |
| Build Hostinger: `npx prisma generate` | 🟡 | Sudah didokumentasikan; pastikan terpasang di panel |
| Monitor health + log 24 jam pertama | 🔴 | Termasuk `socket.disconnectReasons` |

### D. Fitur produk MVP — sudah ada vs sisa

| Item | Status | Catatan |
|------|--------|---------|
| Auth / profile / verification / party | ✅ | |
| Opportunity Need/Offer + quota | ✅ | |
| Matching + ranking + fraud guard dasar | ✅ | |
| Invitation → Deal state machine | ✅ | |
| Chat REST + WebSocket | ✅ | |
| Notifikasi in-app + event `notification:new` | ✅ | |
| Membership + boost (kode) | ✅ | Uji E2E checkout/webhook masih 🟡 |
| Google OAuth | ⬜ | Konfigurasi Supabase dashboard; bukan blocker ketat |
| Escrow payout bank penuh | ⬜ | Modul hold/confirm ada; payout post-MVP |
| Email / WhatsApp production | ⬜ | post-MVP |
| Suite E2E / integration test penuh | ⬜ | Unit test sebagian ada |

### E. Observability WebSocket (sudah bisa dipakai)

```bash
curl -s https://<api>/api/v1/health | jq .socket
```

Perhatikan:

- `disconnectReasons` — dominan `transport close` → cek proxy timeout; `ping timeout` → jaringan / `WS_PING_TIMEOUT_MS`
- `compression` — `ratio` / `savedPercent` (estimasi application-level)
- `authFailures` — token invalid / profile belum lengkap

Env terkait WS: lihat `.env.example` (`WS_*`).

### F. Urutan saran sebelum soft-launch publik

1. Ops: DB + Redis + migrate/seed + CORS + Midtrans webhook (blokir go-live)
2. Security kode: revalidasi/ban WS, rate limit event WS, error generik production
3. Ops: WSS + `proxy_read_timeout` ≥ 90s
4. QA manual: auth → opportunity → match → chat → notifikasi → (opsional) membership sandbox
5. Pantau `GET /api/v1/health` (termasuk `socket`) 24–48 jam

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
chat anti-spam, webhook payment hardened, account suspend/ban,
batas koneksi WebSocket + heartbeat + kompresi frame.

Hardening yang masih terbuka untuk MVP: **revalidasi sesi WS**, **rate limit event WS**,
**error generik production** — lihat tabel Security di atas.

---

## 5. Roadmap

- **MVP / soft-launch:** tabel backlog di atas + `docs/GO_LIVE.md`
- **Post-MVP:** escrow payout bank, notifikasi email/WA, Google OAuth, E2E tests,
  optimasi matching skala besar, Redis adapter Socket.IO multi-instance

---

## Lisensi & kontribusi

Lihat `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
