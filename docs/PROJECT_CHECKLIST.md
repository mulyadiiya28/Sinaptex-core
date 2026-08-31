# Business Matching Bridge — Master Project Checklist

> ## ⚠️ CATATAN PIVOT (baca ini dulu)
> Setelah Phase 18–22 (Fraud/Decision/Diagnosis/Intent Engine) dibangun, muncul **MVP
> Checklist v1.0** yang jauh lebih pragmatis (Auth lengkap, Membership+Payment, Chat,
> Admin Panel, halaman legal). Keputusan eksplisit: **pivot penuh ke MVP checklist**,
> engine Phase 18–22 **DIBEKUKAN** (kode tetap ada & tetap aktif di router, tidak
> dihapus, cuma tidak dikembangkan lebih lanjut untuk saat ini). Prioritas MVP dikerjakan
> Phase 8 (Chat/WebSocket) lebih dulu karena komponen teknisnya paling baru.
> Detail MVP checklist lengkap ada di bagian **PHASE MVP** di bawah, terpisah dari
> Phase 00–22 (checklist "Enterprise Software Lifecycle" awal) yang sekarang berstatus
> dibekukan.

> Disusun ulang dari checklist "Enterprise Software Lifecycle" asli.
> **Catatan adaptasi stack:** checklist sumber berasumsi NestJS. Project ini
> tetap memakai **Express.js**, jadi istilah NestJS di-mapping ke pola Express
> yang setara (lihat kolom *Padanan Express* di setiap phase). Tidak ada
> `module.ts`/decorator ala Nest — Express memakai `*.routes.js` + composition
> function biasa.
>
> Status: ✅ sudah ada di scaffold sebelumnya · 🟡 sebagian ada · ⬜ belum dikerjakan

---

## PHASE 00 — PROJECT FOUNDATION

### Repository
- [ ] Git Repository (`git init`, remote GitHub/GitLab)
- [ ] GitHub Organization
- [ ] Branch Strategy (`main` / `develop` / `feature/*` / `hotfix/*`)
- [ ] Conventional Commit (`feat:`, `fix:`, `chore:`, dst — ditegakkan via Commitlint)
- [ ] Pull Request Template
- [ ] Issue Template (bug report, feature request)
- [ ] CODEOWNERS
- [ ] LICENSE
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md
- [ ] SECURITY.md
- [ ] CODE_OF_CONDUCT.md

### Dokumentasi (`docs/`)
- [ ] Vision
- [ ] Business Requirement (BRD)
- [ ] Functional Requirement (FRD)
- [ ] Non-Functional Requirement (NFR)
- [ ] Product Roadmap
- [ ] Architecture
- [x] ERD — tercermin di `prisma/schema.prisma`, versi diagram terpisah menyusul
- [ ] Flowchart
- [ ] Sequence Diagram
- [ ] API Contract (OpenAPI/Swagger)
- [ ] Coding Standard
- [ ] Folder Structure
- [ ] Naming Convention
- [ ] Git Workflow
- [ ] Branch Strategy (detail teknis)
- [ ] Deployment Guide
- [ ] Backup Strategy
- [ ] Disaster Recovery
- [ ] Monitoring Guide

---

## PHASE 01 — PROJECT INITIALIZATION

**Padanan Express:** tidak ada `nest new`; inisialisasi manual `npm init` + `express` + struktur folder manual (sudah ada).

- [x] Initialize Project (`package.json`, `src/app.js`, `src/server.js`)
- [x] TypeScript Configuration — *(opsional; project ini JS murni, sengaja dilewati — lihat catatan di header)*
- [x] ESLint
- [x] Prettier
- [x] Husky (git hooks)
- [x] Lint-Staged
- [x] Commitlint

### Package
- [x] Prisma
- [x] PostgreSQL (via Supabase connection string)
- [x] Supabase (Auth + DB)
- [x] Swagger (`swagger-jsdoc` + `swagger-ui-express`) — *(mounted di `/api/docs`, spec masih minim sampai JSDoc `@openapi` ditambah per route)*
- [x] Helmet
- [x] Compression
- [x] Cookie Parser
- [x] Zod — *(padanan Express dari `class-validator`/`class-transformer`)*
- [x] Config Module — *(padanan Express: `src/config/*.config.js` + `dotenv`)*
- [x] Schedule — *(padanan Express: `node-cron`, config siap di `scheduler.config.js`, job handler-nya menyusul Phase 11)*
- [x] BullMQ — *(dependency + `queue.config.js` siap, worker/producer aktual menyusul Phase 11)*
- [x] Redis — *(dependency `ioredis` + `redis.config.js` siap, belum dipakai aktif — lihat Phase 05)*
- [x] EventEmitter2 — *(dependency siap, event bus aktual menyusul Phase 05)*

---

## PHASE 02 — PROJECT STRUCTURE

**Padanan Express** untuk struktur ala Nest (`core/`, `shared/`, `modules/`):

```
src/
  config/       -> ✅ sudah ada (env, prisma, cloudinary, supabase)
  core/         -> ✅ sudah ada (logger, cache, queue, event-bus)
  shared/       -> ✅ sudah ada (pagination, constants, enums, mapper)
  modules/      -> ✅ sudah ada (auth, profile, verification, opportunity, boost, matching, ranking, invitation, review, notification)
  jobs/         -> ✅ sudah ada (4 cron job + scheduler.js, proses terpisah)
  queue/        -> ✅ sudah ada (partyStats.worker.js, notification.worker.js)
  events/       -> 🟡 folder ada, listener eksplisit menyusul (event bus sudah emit dari controller langsung)
  routes/       -> ✅ sudah ada (aggregator index.js)
```

---

## PHASE 03 — CONFIGURATION (`src/config/`)

  - [x] `env.js` — *(tetap jadi sumber env mentah, config lain di bawah membaca dari sini)*
  - [x] Pecah jadi file terpisah sesuai checklist asli:
  - [x] `app.config.js`
  - [x] `auth.config.js`
  - [x] `database.config.js`
  - [x] cloudinary/supabase config (`cloudinary.js`, `supabase.js`, dibungkus lagi oleh `storage.config.js`)
  - [x] `cache.config.js`
  - [x] `redis.config.js`
  - [x] `queue.config.js`
  - [x] `scheduler.config.js`
  - [x] `storage.config.js`
  - [x] `notification.config.js`
  - [x] `logger.config.js`
  - [x] `throttle.config.js` — *(dipakai di `app.js` untuk `express-rate-limit`)*
  - [x] `swagger.config.js` — *(dipakai di `app.js`, mount di `/api/docs`)*
  - [x] `validation.js` — *(global Zod error map, di-require sebagai side-effect di `app.js`)*

---

## PHASE 04 — DATABASE FOUNDATION (`prisma/`)

### Database
- [x] `schema.prisma`
- [x] Migration — *(perintah `npm run prisma:migrate` siap; belum dijalankan di sandbox ini karena tanpa akses DB, jalankan di sisi developer)*
- [x] Seed (`prisma/seed.js`) — boost plans + kategori dasar + master data (country/province/city/currency/language/tag)
- [x] Reset Script — `npm run prisma:reset`
- [x] Backup Script — `prisma/scripts/backup.sh` (`npm run db:backup`)
- [x] Restore Script — `prisma/scripts/restore.sh` (`npm run db:restore`)
- [x] RLS Policy — `prisma/rls-policies.sql` (defense-in-depth untuk akses langsung Supabase client)

### Master Data
- [x] Categories
- [ ] Skills — *(sengaja tidak dibuat model terpisah — `Capability` sudah berfungsi setara, lihat catatan desain)*
- [x] Capabilities
- [x] Tags — *(tabel master `Tag` sudah ada untuk referensi/autocomplete; `Opportunity.tags` tetap `String[]` denormalized untuk kompatibilitas, belum di-join-kan)*
- [x] Countries
- [x] Provinces
- [x] Cities
- [x] Currencies
- [x] Languages

### Operational Data
- [x] Profile
- [x] Party
- [ ] Party Member — *(belum ada; saat ini Party hanya 1 owner, belum multi-anggota)*
- [ ] Need — *(saat ini digabung sebagai `Opportunity.type = NEED`)*
- [ ] Offer — *(saat ini digabung sebagai `Opportunity.type = OFFER`)*
- [x] Opportunity
- [x] Media

### Supporting Engine
- [x] Verification
- [x] Review
- [ ] Reputation — *(saat ini skor tersimpan di `Profile`, belum tabel riwayat terpisah)*
- [x] Boost
- [ ] Statistics
- [ ] Activity
- [ ] History
- [x] Notification
- [ ] Webhook Subscription

---

## PHASE 05 — CORE INFRASTRUCTURE (`src/core/`)

**Padanan Express** untuk Guards/Decorators/Pipes/Interceptors/Exception Filter ala Nest:

### Authentication
- [x] Supabase Auth (verifikasi token di `auth.middleware.js`)
- [x] JWT — *(token Supabase, diverifikasi server-side)*
- [ ] Session — *(stateless saat ini, tidak ada session store)*
- [ ] RBAC — *(baru role-check dasar via `requireRole`, belum matrix permission penuh)*

### Security
- [x] Guards → **padanan:** `requireAuth` / `requireRole` middleware
- [ ] Decorators → **padanan:** tidak relevan langsung di Express; bisa diganti helper function
- [x] Middleware (auth, error, upload, validate)
- [x] Pipes → **padanan:** `validate.middleware.js` (Zod parse)
- [ ] Interceptors → **padanan:** response-transform middleware (belum ada, saat ini pakai `apiResponse.js` manual)
- [x] Exception Filter → **padanan:** `error.middleware.js`
- [ ] Data Masking
- [ ] Audit Middleware

### Infrastructure
- [x] Prisma
- [x] Logger — `src/core/logger.js` (structured JSON, level dari `logger.config.js`, dipakai di `error.middleware.js`)
- [x] Cache — `src/core/cache.js` (Redis via ioredis, fail-safe kalau Redis tidak ada; dipakai di `boost.controller.js`)
- [x] Queue — `src/core/queue.js` (BullMQ producer) + `src/queue/*.worker.js` (consumer, proses terpisah)
- [x] Scheduler — `src/jobs/scheduler.js` (`node-cron`, proses terpisah, `npm run scheduler`)
- [x] Event Bus — `src/core/eventBus.js` (eventemitter2), dipakai di invitation & deal controller
- [x] Storage (Cloudinary)
- [ ] Mail
- [x] Notification — *(in-app aktif; worker `notification.worker.js` sudah ada sebagai kerangka untuk channel lain, belum ada provider aktual)*

---

## PHASE 06 — SHARED COMPONENTS (`src/shared/`)

- [x] DTO → **padanan:** Zod schema di `src/validations/`
- [x] Validators → Zod
- [ ] Pagination — *(helper generik `src/shared/pagination.js` sudah ada, baru dipakai di modul Opportunity — modul lain menyusul)*
- [x] API Response → `src/utils/apiResponse.js`
- [x] Error Response → `src/utils/apiError.js`
- [ ] Constants
- [ ] Enums → **padanan:** Prisma enum (`schema.prisma`) sudah berfungsi sebagai sumber kebenaran
- [ ] Interfaces/Types → *(tidak relevan tanpa TypeScript; skip kecuali migrasi ke TS)*
- [ ] Helpers
- [ ] Mapper
- [ ] Utilities → sebagian di `src/utils/`

---

## PHASE 07 — BUSINESS MODULES

**Struktur per module ala Nest → padanan Express** (tidak perlu `module.ts`, `entity/`, `policy/` terpisah — cukup):
```
modules/<nama>/
  <nama>.controller.js
  <nama>.service.js      (opsional, untuk logic kompleks)
  <nama>.routes.js
  (validasi ada di src/validations/<nama>.validation.js)
```

- [x] Auth
- [x] Profile
- [x] Party → modul mandiri `party/` (sebelumnya cuma bisa dibuat sekali lewat `auth/register`,
      sekarang ada `POST/GET /parties`, `PATCH /parties/:id`, kelola Capability)
- [ ] Need → *(menyatu di `opportunity`)*
- [ ] Offer → *(menyatu di `opportunity`)*
- [x] Opportunity
- [x] Review
- [x] Verification
- [x] Notification
- [ ] Admin
- [ ] Dashboard

---

## PHASE 08 — MATCHING ENGINE

- [x] Hard Filter (`matching.service.js` → `passesHardFilter`)
- [x] Category Matching
- [ ] Skill Similarity → *(saat ini gabung ke `capabilityMatch`)*
- [x] Capability Similarity
- [x] Location Similarity
- [x] Budget Similarity
- [x] Tag Similarity
- [x] Text Similarity
- [x] Priority Score
- [x] Reputation Score (di Ranking Engine)
- [x] Activity Score (di Ranking Engine)
- [x] Boost Score (di Ranking Engine)
- [x] Final Ranking (`ranking.service.js`)
- [x] Explainable Breakdown (`matchBreakdown` + `rankingBreakdown` dikembalikan di response)

---

## PHASE 09 — BUSINESS WORKFLOW ENGINE

### Need / Offer *(saat ini disatukan sebagai `Opportunity.type`)*
- [ ] Draft — *(status `DRAFT` sudah ada di enum, belum ada endpoint transisi eksplisit)*
- [x] Publish — *(status `ACTIVE`)*
- [ ] Archive — *(belum ada, bisa pakai status `CLOSED`)*
- [x] Expired — *(`expireOpportunities.job.js` auto-transition via scheduler)*

### Opportunity (via Match → Invitation → Deal)
- [x] Match
- [x] Invite
- [x] Accept
- [x] Reject
- [x] Negotiating
- [x] Deal
- [x] In Progress
- [x] Completed
- [x] Cancelled
- [x] Expired → *(`expireInvitations.job.js` auto-expire invitation PENDING > 14 hari via scheduler)*

---

## PHASE 10 — SUPPORTING ENGINES

### Boost Engine
- [x] Free / Basic / Premium / VIP
- [x] Priority Calculation

### Reputation Engine
- [x] Rating
- [x] Review
- [x] Completion Rate
- [x] Response Rate
- [ ] Cancel Rate → *(dihitung sebagai penalty di Ranking, belum expose sebagai skor tersendiri)*
- [ ] Expired Rate → *(sama seperti di atas)*
- [x] Trust Score → *(field `trustScore` di Profile ada, formula agregasi belum diisi otomatis)*

### Verification Engine
- [x] Identity Verification (KTP)
- [ ] Tax Verification (NPWP) → *(tipe dokumen sudah ada, alur verifikasi otomatis belum)*
- [ ] Business License Verification (NIB) → *(sama seperti di atas)*
- [ ] Company Registration Verification
- [ ] Professional License Verification
- [ ] Certification Verification
- [ ] Address Verification
- [ ] Bank Account Verification

### Notification Engine
- [x] In App
- [ ] Push
- [ ] Email
- [ ] SMS
- [ ] WhatsApp
- [ ] Webhook
- [ ] Retry
- [ ] Queue
- [ ] Template
- [ ] Scheduling

---

## PHASE 11 — BACKGROUND SERVICES (`src/jobs/`, `src/queue/`)

- [x] Expired Job — `src/jobs/expireOpportunities.job.js`, `expireInvitations.job.js`
- [ ] Reminder Job
- [x] Cleanup Job — `src/jobs/cleanupNotifications.job.js`
- [x] Reputation Update Job — `src/jobs/recomputePartyStats.job.js` (safety-net, on-demand recompute tetap jalan di request path)
- [ ] Statistics Update Job — *(beda dari reputation; belum ada agregat statistik terpisah)*
- [x] Notification Retry Job — *(kerangka retry ada di `notification.config.js` + worker, provider aktual belum)*
- [ ] Queue Monitoring — *(belum ada dashboard, lihat Phase 14)*

---

## PHASE 12 — API

- [x] REST API
- [x] Versioning — `/api/v1/*` (alias `/api/*` tanpa versi tetap aktif untuk kompatibilitas)
- [x] Swagger — mounted `/api/docs`, JSDoc `@openapi` sudah di `opportunities`, `matching`, `fraud-flags`
- [x] Pagination — helper generik `src/shared/pagination.js`, dipakai di Opportunity & FraudFlag
- [x] Filtering — Opportunity: `type`, `categoryId`, `status`, `location`, `tag`, `budgetMin/Max`
- [x] Sorting — Opportunity: `sortBy`(createdAt/budgetMin/budgetMax/priority) + `sortOrder`
- [x] Searching — Opportunity: `search` (title/description, case-insensitive)
- [x] Upload (Cloudinary via multer)
- [ ] Download
- [x] Rate Limiting (`express-rate-limit`, global, konfigurasi di `throttle.config.js`)

---

## PHASE 13 — TESTING

- [x] Unit Test — Jest siap (`jest.config.js`, `npm test`), fokus prioritas: Matching Engine (`tests/unit/matching.service.test.js`), Ranking Engine (`ranking.service.test.js`), Fraud Detection sync checks (`fraud.service.test.js`), plus `pagination.test.js`, `apiError.test.js`, `opportunity.validation.test.js`
- [ ] Integration Test (DB, API, Queue, Scheduler) — belum ada, butuh test DB terpisah
- [ ] End-to-End Test (Auth, Need, Offer, Matching, Opportunity, Notification, Verification)
- [ ] Performance Test (Load, Stress, Benchmark)
- [ ] Security Test (SQL Injection, XSS, CSRF, JWT, RLS, Authorization)

---

## PHASE 14 — OBSERVABILITY

- [x] Health Check → *(`GET /api/health` sekarang cek koneksi DB via `SELECT 1`, return 503 kalau gagal)*
- [ ] Structured Logging
- [ ] Audit Logging
- [ ] Metrics
- [ ] Queue Dashboard
- [ ] Scheduler Dashboard
- [ ] Error Tracking (Sentry dll)
- [ ] Alerting
- [ ] Tracing

---

## PHASE 15 — DEVOPS

- [x] Dockerfile — multi-stage (`node:20-alpine`), non-root user, healthcheck bawaan
- [x] Docker Compose — `api` + `redis` + `worker-party-stats` + `worker-notification` + `scheduler`
- [x] GitHub Actions — `.github/workflows/ci.yml`
- [x] CI Pipeline — lint + Jest (dengan Redis service container) + Docker build check
- [ ] CD Pipeline — belum ada target deploy otomatis (tergantung platform hosting pilihan)
- [x] Environment Management — `.env.example` lengkap, dipisah per-config module
- [ ] Secret Management — belum ada vault/rotation otomatis
- [ ] Reverse Proxy
- [ ] SSL/TLS
- [ ] CDN → *(Cloudinary sendiri sudah berfungsi sebagai CDN untuk media)*
- [x] Object Storage → *(Cloudinary)*
- [x] Redis → *(via `docker-compose.yml`, opsional/fail-safe)*
- [x] PostgreSQL → *(Supabase, hosting-nya sudah ditangani Supabase)*

---

## PHASE 16 — PRODUCTION READINESS

### Security
- [x] HTTPS → *(ditangani platform hosting/Supabase, bukan di kode)*
- [ ] CSP
- [ ] HSTS
- [x] CORS (`cors` middleware, origin dari env)
- [x] Helmet
- [ ] Secret Rotation
- [ ] Backup
- [ ] Disaster Recovery
- [ ] Penetration Test

### Performance
- [ ] Redis Cache
- [ ] Database Index → *(sudah ada beberapa `@@index` di schema, belum lengkap semua query panas)*
- [ ] Query Optimization
- [ ] Queue Optimization
- [x] Pagination → *(baru sebagian)*
- [ ] Lazy Loading
- [ ] Compression

### Reliability
- [x] Health Check Endpoint → *(cek DB, lihat Phase 14)*
- [x] Graceful Shutdown (`server.js` SIGINT/SIGTERM)
- [ ] Auto Restart
- [ ] Retry Policy
- [ ] Circuit Breaker
- [ ] Monitoring
- [ ] Alerting
- [ ] Rollback Strategy

---

## PHASE 17 — POST PRODUCTION

- [ ] Monitoring Dashboard
- [ ] User Analytics
- [ ] Audit Report
- [ ] Performance Review
- [ ] Bug Tracking
- [ ] Feature Flag Management
- [ ] Versioning & Release Management
- [ ] Capacity Planning
- [ ] Security Audit Berkala
- [ ] Database Maintenance

---

## PHASE 18 — FRAUD DETECTION ENGINE (tambahan di luar checklist asli)

> Ditambahkan atas permintaan eksplisit: cegah "fake completed activity" — Deal yang
> diselesaikan padahal kedua Party sebenarnya satu pihak atau berelasi tersembunyi.

### Skema (`prisma/schema.prisma`)
- [x] `PartyRelationship` — cache hubungan terdeteksi (SAME_OWNER, SHARED_LEGAL_ID, SHARED_DOCUMENT,
      DECLARED_AFFILIATE, SUSPECTED_COLLUSION)
- [x] `FraudFlag` — insiden yang ditandai (severity, reasonCode, details, riskScore, status review)
- [x] `VerificationDocument.fileHash` — SHA-256 file, dihitung saat upload (`crypto` built-in, tanpa dependency baru)

### Deteksi (`src/modules/fraud/fraud.service.js`)
- [x] Same Owner Check — dua Party dengan `ownerId` yang sama → CRITICAL
- [x] Shared Legal Identity Check — NPWP/NIB sama antar 2 Party → CRITICAL
- [x] Shared Document Check — hash dokumen verifikasi sama dipakai 2 Party berbeda → HIGH
- [x] Deal Concentration Check — >80% deal COMPLETED sebuah Party hanya dengan 1 lawan → HIGH/MEDIUM
- [x] Completion Velocity Check — Deal selesai < 1 jam sejak IN_PROGRESS → LOW (sinyal lemah, berbobot saat digabung)
- [x] Known Relationship Check — baca cache `PartyRelationship` (termasuk yang ditandai admin manual)
- [x] Agregator `runFraudChecks()` — jumlah risk score lintas semua check, block kalau ≥ `blockThreshold`

### Titik Integrasi
- [x] Matching Engine — exclude kandidat dengan `ownerId` sama (self-dealing lewat 2 Party) dan
      kandidat yang sudah punya cached relationship SAME_OWNER/SHARED_LEGAL_ID/SHARED_DOCUMENT
- [x] Deal state machine — fraud check wajib jalan sebelum transisi ke `COMPLETED`; block kalau
      risk score tinggi (409 + detail temuan), tetap lanjut + buat `FraudFlag` kalau di bawah ambang blokir
- [x] Verification upload — hitung & simpan `fileHash`, log kalau ada duplikat lintas Party
- [x] Job harian `fraudScan` — scan ulang deal 24 jam terakhir untuk pola yang baru terbentuk (drift)

### Admin Review (`src/modules/fraud/fraud.controller.js`)
- [x] `GET /fraud-flags` — list (filter status), `GET /fraud-flags/:id` — detail + kedua Party + Deal
- [x] `PATCH /fraud-flags/:id/review` — admin putuskan CONFIRMED/DISMISSED
- [x] DISMISSED menghapus cache `SUSPECTED_COLLUSION` supaya tidak terus memblokir kalau false-positive

### Konfigurasi (`src/config/fraud.config.js`)
- [x] `severityWeight`, `blockThreshold` (90), `warnThreshold` (25)
- [x] `concentration.{minCompletedDealsToCheck, highRatio, mediumRatio}`
- [x] `velocity.suspiciousUnderHours`

### Belum Ada (lanjutan yang masuk akal)
- [ ] Device/IP fingerprinting saat registrasi (sinyal tambahan untuk SUSPECTED_COLLUSION)
- [ ] Machine learning-based anomaly scoring (saat ini rule-based murni)
- [ ] Dashboard visual untuk admin (saat ini hanya REST endpoint list/review)
- [ ] Auto-reversal Deal + refund kalau FraudFlag di-CONFIRMED setelah COMPLETED (saat ini manual)
- [ ] Rate-limit khusus percobaan transisi Deal (cegah brute-force testing threshold block)
- [ ] Unit test untuk check yang butuh DB (`checkSharedDocumentHash`, `checkDealConcentration`,
      `checkKnownRelationship`) — baru check sinkron (`checkSameOwner`, `checkSharedLegalIdentity`,
      `checkCompletionVelocity`) yang punya unit test murni saat ini

---

## PHASE 19 — BUSINESS DECISION ENGINE (tambahan di luar checklist asli)

> Ditambahkan atas permintaan eksplisit: engine di ATAS Matching Engine yang mendiagnosis
> kebutuhan sebenarnya (Jobs-to-be-Done) di balik permintaan permukaan, dengan prinsip
> anti-halusinasi — jujur kalau data tidak cukup, bukan menebak. Filosofi lengkap di
> `docs/business-decision-philosophy.md`.

### Skema (`prisma/schema.prisma`)
- [x] `RootProblem` — akar masalah tingkat tinggi
- [x] `JobToBeDone` — kebutuhan fungsional/emosional sebenarnya, format kanonik JTBD
- [x] `SolutionCategory` — istilah literal yang orang cari (mis. "CRM", "Bor Listrik")
- [x] `SolutionCategoryJob` — mapping many-to-many + bobot relevansi (di sinilah ambiguitas direpresentasikan)
- [x] `ClarifyingQuestion` — pertanyaan berbasis data untuk disambiguasi, per Job
- [x] `DecisionInquiry` — satu sesi diagnosis (statedWant → diagnosedJob, confidenceScore, dataSufficiency)
- [x] `DecisionInquiryAnswer` — jawaban user per pertanyaan klarifikasi
- [x] `DecisionRecommendation` — hasil akhir: Opportunity nyata ATAU data-gap alert jujur

### Engine (`src/modules/decision/decision.service.js`)
- [x] `findSolutionCategory()` — keyword-overlap lookup deterministik (bukan tebakan AI generatif)
- [x] `startInquiry()` — mulai diagnosis; auto-resolve kalau tidak ambigu, ajukan `ClarifyingQuestion` kalau ambigu,
      JUJUR mengaku `CLOSED_NO_DATA` kalau basis pengetahuan tidak punya data sama sekali
- [x] `submitAnswer()` + `diagnose()` — hitung ulang confidenceScore & dataSufficiency tiap jawaban baru,
      logic bisa diaudit (bukan black-box)
- [x] `getRecommendations()` — cari Opportunity nyata yang relevan dengan Job terdiagnosis (reuse teknik
      Jaccard text similarity dari Matching Engine, diekstrak ke `src/shared/textSimilarity.js`);
      kalau nol hasil, buat `DecisionRecommendation` dengan `isDataGapAlert: true` — TIDAK mengarang solusi

### API (`src/modules/decision/`)
- [x] `POST /decision/inquiries` — mulai sesi (bisa anonim, pakai `optionalAuth` middleware baru)
- [x] `GET /decision/inquiries/:id` — status diagnosis saat ini
- [x] `POST /decision/inquiries/:id/answers` — jawab klarifikasi
- [x] `GET /decision/inquiries/:id/recommendations` — hasil akhir (rekomendasi atau data-gap alert)
- [x] `GET /decision/knowledge` — baca basis pengetahuan (publik, transparan)
- [x] `POST /decision/knowledge` — tambah entri baru (admin only — basis pengetahuan terkurasi manual,
      bukan digenerate otomatis, supaya jadi aset institusional yang stabil)

### Konfigurasi (`src/config/decision.config.js`)
- [x] `confidence.{minPartial, minSufficient}` — ambang batas dataSufficiency
- [x] `autoResolveWhenUnambiguous` — skip klarifikasi kalau SolutionCategory cuma 1 Job
- [x] `minKeywordOverlap`, `minSolutionRelevance`

### Basis Pengetahuan Awal (`prisma/seed.js`)
- [x] Contoh "Bor Listrik" (tidak ambigu) — sesuai persis ilustrasi permintaan fitur ini
- [x] Contoh "Rumah/Properti" (ambigu, 3 Job: tempat berteduh/pengakuan sosial/investasi)
- [x] Contoh "CRM Software" (tidak ambigu, Job: follow-up pelanggan tidak bocor)

### Belum Ada (lanjutan yang masuk akal)
- [ ] Unit test untuk `decision.service.js` (baru `textSimilarity.js` yang punya test murni;
      fungsi async yang butuh DB — `findSolutionCategory`, `startInquiry`, `diagnose`,
      `getRecommendations` — belum ada test, butuh test DB/mock Prisma)
- [ ] UI wizard klarifikasi (saat ini murni API, belum ada widget interaktif)
- [ ] Analytics: SolutionCategory mana yang paling sering berujung `CLOSED_NO_DATA` atau
      `isDataGapAlert` — sinyal prioritas untuk admin menambah basis pengetahuan/menarik Party baru
- [ ] Endpoint self-service admin promotion (saat ini assign role ADMIN manual lewat Prisma Studio/SQL)
- [ ] Integrasi ke alur Opportunity: opsi "buat Opportunity dari Job yang terdiagnosis" satu klik

---

## PHASE 20 — BUSINESS DIAGNOSIS ENGINE (tambahan di luar checklist asli, level "konsultan")

> Ditambahkan atas permintaan eksplisit lanjutan: bukan cuma "cari produk yang cocok"
> (Phase 19), tapi "diagnosis akar masalah bisnis dari data terukur, dan rekomendasi TIDAK
> selalu produk" (mis. penjualan menurun → bisa jadi butuh pelatihan karyawan, bisa jadi
> cukup saran perbaiki respons review, tergantung data). Filosofi & contoh lengkap di
> `docs/business-decision-philosophy.md` bagian 7–8.

### Skema (`prisma/schema.prisma`)
- [x] `BusinessSymptom` — titik masuk gejala bisnis (beda dari `SolutionCategory` yang berbasis istilah produk)
- [x] `DiagnosticFactor` — data terukur (NUMERIC/PERCENTAGE/BOOLEAN/CATEGORICAL), `sourceType` AUTO_PLATFORM/MANUAL_INPUT
- [x] `BusinessRootCause` — akar masalah spesifik, `recommendationType` ADVISORY_ONLY/MATCH_OPPORTUNITY/HYBRID,
      `jobId` OPSIONAL (hanya dipakai kalau tipe rekomendasinya butuh match produk — desain bertingkat)
- [x] `DiagnosticRule` — kondisi deterministik (`conditions` Json: factorId+operator+value), bisa diaudit
- [x] `AdvisoryContent` — bank saran, WAJIB `status = PUBLISHED` (lewat review admin) sebelum tampil ke user;
      `authorType = AI_DRAFT` didukung untuk draft dari AI eksternal, tetap lewat gerbang review yang sama
- [x] `BusinessDiagnosis` — satu sesi diagnosis (opsional terikat ke `partyId` untuk auto-pull data)
- [x] `BusinessDiagnosisFactorValue` — nilai tiap factor yang terkumpul + provenance (AUTO_PLATFORM/MANUAL_INPUT)
- [x] `BusinessDiagnosisRecommendation` — hasil akhir per tipe (ADVISORY/OPPORTUNITY_MATCH), termasuk data-gap alert

### Engine (`src/modules/business-diagnosis/`)
- [x] `metricsResolver.js` — hybrid data sourcing: `party_conversion_rate`, `party_avg_review_sentiment`,
      `party_response_score` dihitung dari data NYATA (Invitation/Deal/Review); kembalikan `null` eksplisit
      (bukan 0 yang menyesatkan) kalau histori platform belum cukup, supaya jatuh ke MANUAL_INPUT
- [x] `diagnosis.service.js`:
  - `startDiagnosis()` — coba auto-resolve factor AUTO_PLATFORM dulu, baru evaluasi rule dengan data yang ada
  - `submitFactorValue()` — isi manual, re-evaluasi
  - `evaluateAndUpdate()` — evaluasi `DiagnosticRule` berprioritas; kalau ada yang match & datanya lengkap →
    `DIAGNOSED` (confidence dari provenance data: auto > campuran > manual); kalau ada faktor yang masih
    kurang → `DATA_COLLECTION` + daftar `pendingFactors`; kalau semua rule sudah bisa dievaluasi penuh tapi
    TIDAK ADA yang match → `INSUFFICIENT_DATA` (jujur, bukan menebak)
  - `getRecommendations()` — sesuai `recommendationType`: ambil `AdvisoryContent` PUBLISHED (kalau
    ADVISORY_ONLY/HYBRID) dan/atau cari Opportunity nyata via `JobToBeDone` (kalau MATCH_OPPORTUNITY/HYBRID);
    data-gap alert eksplisit di tiap cabang kalau tidak ada yang bisa ditawarkan

### API (`src/modules/business-diagnosis/`)
- [x] `GET /business-diagnosis/symptoms` — katalog gejala (publik)
- [x] `POST /business-diagnosis/sessions` — mulai sesi (butuh login; auto-pull kalau `partyId` disertakan)
- [x] `GET /business-diagnosis/sessions/:id` — status diagnosis
- [x] `POST /business-diagnosis/sessions/:id/factors` — isi factor manual
- [x] `GET /business-diagnosis/sessions/:id/recommendations` — hasil akhir
- [x] `GET/POST /business-diagnosis/knowledge` — kelola basis pengetahuan (tulis admin only)
- [x] `PATCH /business-diagnosis/advisory/:id/publish` — gerbang review sebelum saran boleh tampil ke user

### Konfigurasi (`src/config/diagnosis.config.js`)
- [x] `autoMetrics.{conversionRateWindowDays, reviewSentimentWindowDays}`
- [x] `confidenceByProvenance.{allAuto, mixed, allManual}` — data platform nyata lebih dipercaya dari self-report

### Basis Pengetahuan Awal (`prisma/seed.js`)
- [x] Gejala "Penjualan Menurun" dengan 2 akar masalah yang bersaing, dibedakan murni oleh data:
  skill gap (→ match ke Job pelatihan) vs sentimen negatif (→ advisory saja, tanpa produk)

### Belum Ada (lanjutan yang masuk akal)
- [ ] Unit test untuk fungsi async (`startDiagnosis`, `evaluateAndUpdate`, `getRecommendations` —
      baru `parseFactorValue`/`evaluateCondition` yang punya test murni, butuh mock Prisma untuk sisanya)
- [ ] Endpoint AI-draft generator aktual (skema sudah mendukung `authorType: AI_DRAFT`, tapi belum ada
      integrasi panggilan LLM dari backend ini — draft AI saat ini diasumsikan ditempel manual oleh admin)
- [ ] Metrik auto-pull tambahan (baru 3: conversion rate, sentimen review, response score)
- [ ] UI form dinamis untuk mengisi `DiagnosticFactor` sesuai `dataType` (saat ini murni API)
- [ ] Analytics: symptom/rootCause mana yang paling sering `INSUFFICIENT_DATA` — sinyal ke admin untuk
      memperkaya `DiagnosticRule`

---

## PHASE 21 — INTENT ENGINE (tambahan di luar checklist asli, pintu masuk paling depan)

> Diusulkan user sebagai penyempurnaan arsitektur: pisahkan codebase jadi 3 domain besar
> (`business-intelligence`, `business-matching`, `business-network` — restrukturisasi folder
> menyusul terpisah, lihat catatan di bawah), dan tambahkan **Intent Engine** di depan semuanya
> supaya user tidak dipaksa melalui alur diagnosis kalau memang cuma ingin mencari sesuatu.

```
User → Intent Engine → (DIRECT_SEARCH → Matching Engine) | (NEEDS_DIAGNOSIS → Business Intelligence)
```

### Engine (`src/modules/intent/intent.service.js`)
- [x] `classifyPattern()` — klasifikasi SINKRON, murni rule-based (lexicon di `intent.config.js`), diuji
      lolos 6 contoh kalimat persis dari spesifikasi user (lihat `tests/unit/intent.service.test.js`):
  - Rule 1: pola interogatif ("kenapa", "mengapa", "bagaimana", dst) → `NEEDS_DIAGNOSIS`
  - Rule 2: keyword gejala/tren negatif ("turun", "menurun", "rugi", dst) → `NEEDS_DIAGNOSIS`
  - Rule 3: kata kerja akuisisi + keyword peran (supplier/buyer/investor/partner) → `DIRECT_SEARCH`
  - Rule 4: kata kerja akuisisi TANPA keyword peran → butuh lookup async ke basis pengetahuan
    `SolutionCategory` (Phase 19) — inilah yang membedakan "beli mesin" (tidak ada di KB →
    `DIRECT_SEARCH`) dari "butuh CRM" (ada di KB, mungkin ambigu → `NEEDS_DIAGNOSIS`)
  - Rule 5: tidak ada pola cocok → `AMBIGUOUS`, **tidak pernah ditebak**, tanya balik ke user
- [x] `classifyIntent()` — wrapper async yang melengkapi Rule 4 dengan lookup KB
- [x] `handleIntent()` — orkestrasi penuh: klasifikasi → panggil langsung `searchOpportunitiesDirect()`
      (Matching, hasil inline) ATAU `decisionService.startInquiry()` (Phase 19) ATAU
      `matchBusinessSymptom()` + `diagnosisService.startDiagnosis()` (Phase 20) ATAU — kalau
      symptom tidak yakin — alert jujur + daftar symptom yang tersedia untuk dipilih manual
- [x] Setiap keputusan dicatat ke `IntentLog` (audit trail + bahan `analytics` di masa depan)

### API
- [x] `POST /intent` — **satu-satunya endpoint baru**, titik masuk tunggal dari kalimat bebas
      (publik, `optionalAuth`)

### Migrasi Endpoint Lama
- [x] Endpoint lama TETAP AKTIF PENUH (keputusan eksplisit: migrasi bertahap, bukan breaking change)
- [x] 3 endpoint entry-point ditandai deprecated (header `Deprecation: true` + `Link` ke `/api/v1/intent`,
      lewat `src/middlewares/deprecated.middleware.js`), sisanya (endpoint mid-flow seperti respond
      invitation, update deal, submit factor/answer) TIDAK ditandai karena bukan titik masuk:
  - `GET /opportunities` (pencarian terstruktur tetap berguna, tapi `/intent` jadi rekomendasi utama)
  - `POST /decision/inquiries`
  - `POST /business-diagnosis/sessions`

### Skema (`prisma/schema.prisma`)
- [x] `IntentLog` — audit trail tiap klasifikasi (rawText, category, subtype, matchedPattern, routedTo)

### Restrukturisasi Folder ke 3 Domain — BELUM DIKERJAKAN (keputusan: bertahap)
> Keputusan eksplisit: Intent Engine dulu (additive, aman), baru restrukturisasi folder
> `src/modules/` existing ke domain berikut ini menyusul di sesi terpisah:
- [ ] `business-intelligence/` ← gabung `decision/` (Phase 19) + `business-diagnosis/` (Phase 20) + `analytics` baru
- [ ] `business-matching/` ← `matching/` + `ranking/` + `opportunity/` + `recommendation` baru (lapisan tipis)
- [ ] `business-network/` ← pisahkan `party` dari `auth`/`profile`, gabung `review` + `reputation`
      (saat ini nempel di `ranking/partyStats.service.js`) + `invitation` + `deal`
- [ ] Execution & Monitoring Engine — memantau implementasi/hasil PASCA-Deal (belum ada sama sekali,
      ide baru dari user: alur tidak berhenti di Deal COMPLETED, tapi lanjut pantau hasil nyata)

### Belum Ada (lanjutan yang masuk akal)
- [ ] Unit test untuk `classifyIntent`/`handleIntent` (async, butuh mock Prisma — baru `classifyPattern`
      sinkron yang punya test murni)
- [ ] Analytics dashboard dari `IntentLog` (mis. berapa % `AMBIGUOUS` — sinyal lexicon perlu diperkaya)
- [ ] Rate limiting khusus `/intent` (endpoint publik tanpa auth, lebih rawan disalahgunakan)

---

## Estimasi Kematangan Proyek (checklist "Enterprise Software Lifecycle" — 🧊 DIBEKUKAN)

| Phase | Nama | Status Saat Ini |
|---|---|---|
| 00–03 | Project Foundation | ✅ selesai |
| 04–06 | Architecture & Infrastructure Ready | ✅ selesai |
| 07–10 | Business Feature Complete | 🟡 sebagian besar (matching/ranking/workflow inti ✅, sub-fitur admin/dashboard/channel notifikasi ⬜) |
| 11 | Background Services | ✅ sebagian besar |
| 12 | API Polish | ✅ selesai (versioning, filter/sort/search, Swagger contoh pola) |
| 13 | Testing | 🟡 unit test prioritas (matching/ranking/fraud) ✅, integration/e2e/performance/security test ⬜ |
| 15 | DevOps | ✅ sebagian besar (Docker + CI ✅, CD/secret-rotation/reverse-proxy ⬜) |
| 16 | Production Ready | ⬜ belum dimulai |
| 17 | Operasional & Continuous Improvement | ⬜ belum dimulai |
| 18 | Fraud Detection Engine (tambahan) | 🧊 dibekukan, sudah sebagian besar jalan (rule-based check + block gate + admin review) |
| 19 | Business Decision Engine (tambahan) | 🧊 dibekukan, sudah sebagian besar jalan (diagnosis JTBD + anti-halusinasi) |
| 20 | Business Diagnosis Engine (tambahan) | 🧊 dibekukan, sudah sebagian besar jalan (symptom→factor→rule→root cause) |
| 21 | Intent Engine (tambahan) | 🧊 dibekukan, sudah sebagian besar jalan (classifyPattern deterministik) |
| 22 | Split Diagnosis/Decision + Domain/Capability/Pattern Detection + Learning Engine (tambahan) | 🧊 dibekukan, schema selesai (47→49 model), service layer selesai |

**Semua di atas TETAP AKTIF di router** (`/api/v1/fraud-flags`, `/decision`, `/business-diagnosis`,
`/intent`) — tidak dihapus, cuma tidak lagi jadi fokus pengembangan sampai MVP di bawah live.

---

## PHASE MVP — MVP Checklist v1.0 (fokus pengembangan SAAT INI)

> Prinsip pegangan dari user: **"Profile adalah pusat ekosistem"** — Need dan Offer
> hanyalah aktivitas yang dilakukan oleh sebuah Profile. Ini sudah konsisten dengan
> skema yang ada (`Profile` 1—N `Party`, `Party` 1—N `Opportunity`).

### MVP Phase 1 — Foundation ✅ CMS backend selesai (Branding & Landing Page tetap tanggung jawab frontend)
- [x] **CMS ringan** — `StaticPage` (slug/title/content/status) + `FaqItem`, modul `content/`
  - Publik: `GET /content/pages/:slug`, `GET /content/faq` (HANYA `status: PUBLISHED` yang dikembalikan)
  - Admin: `GET/PUT /admin/content/pages/:slug` (upsert), CRUD penuh `/admin/content/faq*`
- [x] Tentang Kami, Cara Kerja, Syarat & Ketentuan, Kebijakan Privasi, Kontak — **di-seed sebagai
      draft placeholder** (`status: DRAFT`, ditandai `TODO admin` di isinya) — WAJIB diisi konten
      final & di-publish admin sebelum go-live, terutama Syarat & Ketentuan dan Kebijakan Privasi
      (isi legal, bukan tanggung jawab teknis)
- [x] FAQ — 3 contoh awal di-seed (draft), admin tinggal tambah/edit/publish lewat `/admin/content/faq`
- [ ] Branding (logo, warna, identitas visual) — sepenuhnya di sisi frontend/desain, tidak ada
      pekerjaan backend
- [ ] Landing Page — di sisi frontend; kontennya bisa tarik dari `GET /content/pages/...` kalau
      butuh bagian yang di-manage CMS (mis. testimoni, FAQ di landing)

### MVP Phase 2 — Authentication
- [x] Login Email, Register Email, Verifikasi Email, Lupa Password, Logout, Session Management
      — *(sudah tercakup oleh Supabase Auth + `auth.middleware.js`, tinggal dikonfigurasi di
      dashboard Supabase — TIDAK perlu kode baru di backend ini)*
- [ ] Login dengan Google — *(aktifkan provider Google di Supabase Auth dashboard; backend
      TIDAK perlu berubah karena `auth.middleware.js` cuma minta valid Supabase access token,
      tidak peduli provider aslinya email atau Google)*

### MVP Phase 3 — Profile ✅ LENGKAP
- [x] Wajib: Nama, Email, Tipe Profil (Individual/Perusahaan) — `Profile.fullName`,
      `User.email`, `Profile.profileType`
- [x] Opsional: Foto Profil, Nomor Telepon, Lokasi, Deskripsi — `avatarUrl`, `phone`,
      `location`, `bio`
- [x] Capability: Industri/Bidang/Capability/Pengalaman — `Capability`, `Category`, `PartyCapability`
- [x] Portfolio: Upload & kelola dokumen/gambar portofolio via `Media` (`ownerType: PROFILE`) —
      `POST /profiles/me/portfolio`, `DELETE /profiles/me/portfolio/:mediaId`
- [x] Reputation (otomatis): Rating, Review, Total Project, Member Since — `Review`,
      `reputationScore` (`partyStats.service.js`), `Profile.createdAt`
- [x] Profile Progress (%) — `GET /profiles/me/progress` & terintegrasi di `GET /profiles/me` (otomatis
      dihitung dari kelengkapan info dasar, entitas bisnis, kapabilitas, & verifikasi legalitas)

### MVP Phase 4 — Membership (✅ domain terpisah — direfaktor sesuai code review)
- [x] **Membership** domain terpisah dari Profile — `Membership` model 1:1 Profile,
      diakses modul lain HANYA lewat `membershipService.hasActiveMembership(profileId)`
- [x] **Pricing** domain terpisah dari Membership — `MembershipPlan` (produk, tanpa harga) +
      `MembershipPricing` (harga historis, `effectiveFrom`/`effectiveUntil`/`status`) +
      `pricingService.calculate()` (siap disambung Promotion/Voucher/Tax nanti)
- [x] **Payment Gateway sebagai adapter/factory** — `src/core/payment/PaymentGateway.js`
      (factory) + `MidtransGateway.js` (implementasi konkret, SEMUA istilah Midtrans
      terkurung di sini) + `PaymentStatus.js` (status internal provider-agnostic).
      Membership cuma panggil `PaymentGateway.getDefault().createTransaction()`
- [x] Webhook per-provider (`POST /membership/webhook/:provider`) — siap multi-gateway
- [x] `PaymentProvider`/`PaymentMethod` enum Prisma — siap untuk laporan transaksi
- [x] Business rule "Chat baru butuh recipient member aktif" — **DITEGAKKAN** di
      `chat.policy.js` (`ConversationPolicy.canStartConversation`)
- [x] Business rule "Need gratis, tidak cek membership" — **DITEGAKKAN** lewat `originType: NEED`
- [x] Business rule "Offer hanya untuk member aktif" — **DITEGAKKAN** di
      `opportunity.controller.js` (`createOpportunity`, cek `hasActiveMembership` kalau `type: OFFER`)
- [x] STUB DEV aktivasi manual (`POST /membership/dev-activate`) — diblokir keras di production

### MVP Phase 5 — Need & MVP Phase 6 — Offer ✅ LENGKAP
- [x] Buat/Publish/Edit — `POST /opportunities`, `PATCH /opportunities/:id` (`type: NEED`/`OFFER`)
- [x] Close (Need) / Hide (Offer) — `POST /opportunities/:id/close` & `PATCH /opportunities/:id/close`
      (hanya pemilik opportunity yang berwenang menutup status ke `CLOSED`)
- [x] Search, Filter — `GET /opportunities` (filter type/category/location/tag/budget, search)
- [x] Detail Need/Offer — `GET /opportunities/:id`

### MVP Phase 7 — Marketplace ✅ LENGKAP
- [x] List/Detail Need & Offer publik — `GET /opportunities`, `GET /opportunities/:id`
- [x] Public Profile (Profil, Capability, Rating, Review) — `GET /profiles/:id`,
      `GET /reviews/profile/:profileId`
- [x] Public Profile Portfolio — `GET /profiles/:id` (menyertakan list portfolio media)

### MVP Phase 8 — Chat ✅ SELESAI
- [x] Conversation — `Conversation` model + `ConversationParticipant`
- [x] `originType` (PROFILE/NEED/OFFER) — percakapan tahu asalnya, dipakai `ConversationPolicy`
- [x] WebSocket — `src/core/socket.js` (Socket.IO), broadcast lewat event bus
- [x] Message — `Message` model + REST + event `message:send`/`message:new` (WS)
- [x] Image, Attachment — upload multipart ke Cloudinary, broadcast via event bus
- [x] Read Status — `ConversationParticipant.lastReadAt` per-partisipan
- [x] Typing Indicator — direct socket relay
- [x] `ConversationPolicy` (`chat.policy.js`) — business rule terpisah dari `chat.service.js`
- [x] Notification saat pesan baru — `notification.listener.js` berlangganan `CHAT_MESSAGE_SENT`

### MVP Phase 9 — Notification ✅ SELESAI
- [x] Notifikasi in-app tersentralisasi (`src/modules/notification/` + `notification.listener.js`)
- [x] Chat Baru — otomatis membuat notifikasi saat `CHAT_MESSAGE_SENT` di-emit
- [x] Review Baru — otomatis membuat notifikasi saat `REVIEW_CREATED` di-emit
- [x] Status Verifikasi Dokumen — otomatis membuat notifikasi saat `VERIFICATION_REVIEWED` di-emit
- [x] Update Status Transaksi/Deal — otomatis membuat notifikasi saat `DEAL_STATUS_CHANGED` di-emit
- [x] Undangan Bisnis Baru — otomatis membuat notifikasi saat `INVITATION_RECEIVED` dibuat
- [x] REST API Notifikasi — `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`

### MVP Phase 10 — Project / Deal
- [x] Deal/Status Project/Complete/Cancel — `Deal` state machine:
      NEGOTIATION → DEAL → IN_PROGRESS → COMPLETED/CANCELLED
- [x] Fraud Check pada penyelesaian deal — `runFraudChecks` otomatis memeriksa risiko sebelum COMPLETED

### MVP Phase 11 — Review ✅ SELESAI
- [x] Rating, Review, Reputasi — `POST /reviews/deal/:dealId`, `GET /reviews/profile/:profileId`
- [x] Event & Notifikasi — `REVIEW_CREATED` terhubung ke penghitungan statistik reputasi & notifikasi

### MVP Phase 12 — Admin ✅ SELESAI
- [x] Dashboard — `GET /admin/dashboard`
- [x] User management — `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status`
- [x] Membership/Payment overview — `GET /admin/transactions`
- [x] Need/Offer moderation — `GET /admin/opportunities`, `PATCH /admin/opportunities/:id/status`
- [x] Review moderation — `GET /admin/reviews`, `PATCH /admin/reviews/:id/visibility`
- [x] Report User — `POST /reports`, `GET/PATCH /admin/reports`
- [x] CMS — `/admin/content/*`

### MVP Phase 13 — Security ✅ SELESAI
- [x] CORS Whitelist Protection — whitelist ketat domain frontend produksi & authorized origins
- [x] JWT — via Supabase Auth token verification
- [x] RBAC — `requireRole('ADMIN')`
- [x] Rate Limiting — global (`express-rate-limit`)
- [x] Validasi Input — Zod di semua endpoint
- [x] Block / Suspend User — `accountStatus` ditegakkan di `requireAuth` pintu terdepan

### MVP Phase 14 — Production & MVP Phase 15 — Go Live
- [x] Docker, PostgreSQL (Supabase), Redis, CI/CD — siap deploy
- [x] Object Storage — Cloudinary
- [x] Healthcheck unversioned (`/health` & `/api/v1/health`)

---

**Urutan pengerjaan MVP berikutnya yang disarankan:** MVP Phase 4 (Membership+Payment Gateway
sungguhan, ganti stub) → MVP Phase 12 (Admin Panel — makin penting begitu ada payment & user
banyak) → MVP Phase 1 (halaman statis/legal, wajib sebelum Go Live) → MVP Phase 9 (perluas
Notification ke Chat) → MVP Phase 14-15 (Production & Go Live).
