# Architecture Overview

## High-Level Diagram (tekstual)

```
┌────────────┐      ┌──────────────────────────────┐      ┌──────────────┐
│  Client    │─────▶│  Express API (this repo)      │─────▶│  Supabase     │
│ (Web/App)  │      │  /api/*                        │      │  Postgres DB  │
└────────────┘      │                                 │      └──────────────┘
       │             │  - auth.middleware (verify JWT)│
       │             │  - validate.middleware (Zod)   │      ┌──────────────┐
       │             │  - modules/* (controllers)     │─────▶│  Cloudinary   │
       │             │  - matching + ranking engine    │      │  (file store) │
       ▼             └──────────────────────────────┘      └──────────────┘
┌────────────┐
│ Supabase   │  (Client login/signup langsung ke Supabase Auth,
│ Auth       │   lalu kirim access token ke Express API)
└────────────┘
```

## Komponen Utama

| Komponen | Teknologi | Peran |
|---|---|---|
| API Server | Express.js | Business logic, orchestrasi engine |
| ORM | Prisma | Akses DB tipe-aman, migration |
| Database | Supabase Postgres | Penyimpanan data utama |
| Auth | Supabase Auth | Identity provider, JWT issuance |
| File Storage | Cloudinary | Dokumen verifikasi & media Opportunity |
| Validasi | Zod | Validasi & parsing request |

## Alur Request Tipikal

1. Client login via Supabase Auth (client-side SDK) → dapat `access_token`
2. Client kirim request ke Express dengan header `Authorization: Bearer <token>`
3. `auth.middleware.js` verifikasi token ke Supabase, resolve `User`+`Profile` lokal
4. `validate.middleware.js` parse & validasi body/query/params dengan Zod
5. Controller jalankan logic (langsung atau lewat service, misal matching/ranking)
6. Prisma query/mutate ke Supabase Postgres
7. Response diformat konsisten lewat `apiResponse.js` / error lewat `apiError.js` + `error.middleware.js`

## Prinsip Desain

- **Modular per domain**: setiap fitur bisnis (`auth`, `opportunity`, `matching`, dst) adalah folder
  mandiri di `src/modules/`, tidak saling bergantung langsung — komunikasi lewat Prisma/DB atau
  pemanggilan service eksplisit (mis. `matching` memanggil `ranking` & `partyStats`).
- **Explainable engine**: matching & ranking selalu mengembalikan breakdown skor, bukan hanya angka akhir.
- **Fail-safe ownership check**: setiap mutasi resource memvalidasi kepemilikan (`ownerId === req.profile.id`)
  sebelum eksekusi.

## Yang Belum Ada (lihat `PROJECT_CHECKLIST.md` Phase 05/11)
- Cache layer (Redis)
- Queue/worker (BullMQ) untuk job berat
- Event bus formal (masih pemanggilan fungsi langsung, belum event-driven)
