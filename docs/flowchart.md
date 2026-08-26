# Flowchart — Business Matching Bridge

## Layer 0 (baru) — Business Decision Engine, DI ATAS semua alur di bawah

```
User: "saya butuh CRM" / "saya lagi cari rumah" / dll (permintaan permukaan)
  │
  ▼
CARI SolutionCategory (keyword lookup, deterministik dari basis pengetahuan)
  │
  ├──▶ TIDAK KETEMU ──▶ CLOSED_NO_DATA: "kami belum punya basis pengetahuan untuk ini" (JUJUR, tidak menebak)
  │
  └──▶ KETEMU
         │
         ▼
   Ambigu? (SolutionCategory ini punya >1 kemungkinan Job)
         │
    ┌────┴────┐
   TIDAK      YA
    │          │
    ▼          ▼
 Auto-      Ajukan ClarifyingQuestion (per kandidat Job)
 diagnosis     │
    │          ▼
    │      User jawab ──▶ hitung ulang confidenceScore & dataSufficiency
    │          │
    │     cukup yakin (SUFFICIENT)?
    │          │
    │      ┌───┴───┐
    │     TIDAK    YA
    │      │        │
    │   (tanya    DIAGNOSED: Job yang sebenarnya dibutuhkan
    │   lagi)        │
    └────────────────┤
                      ▼
         Cari Opportunity NYATA di platform yang relevan
         dengan Job ini (lewat Matching Engine, Layer 1 di bawah)
                      │
                ┌─────┴─────┐
             ADA          TIDAK ADA
              │              │
              ▼              ▼
        Rekomendasikan   DATA GAP ALERT: "kebutuhan Anda adalah X,
        Opportunity      tapi belum ada solusi di platform ini"
        nyata + alasan   (JUJUR, tidak mengarang solusi)
```

## Layer 1 — Alur bisnis inti (Register → ... → Deal)

Alur utama end-to-end (sesuai desain awal yang disepakati):

```
START
  │
  ▼
1. REGISTER / LOGIN
   - Supabase Auth
   - Buat Profile
   - Buat Party (opsional)
   - Assign Business Role
   - Assign Capability
  │
  ▼
2. VERIFICATION ENGINE
   Upload: KTP, NIB, NPWP, Sertifikat, Lainnya
   Status: UNVERIFIED → PENDING → VERIFIED / REJECTED
  │
  ▼
3. CREATE OPPORTUNITY (Need / Offer)
   Category, Capability, Location, Budget, Tags,
   Description, Priority, Visibility, Media
  │
  ▼
4. BOOST ENGINE
   FREE / BASIC / PREMIUM / VIP
   package, priorityWeight, startAt, expiredAt, paymentStatus
  │
  ▼
5. MATCHING ENGINE
   Hard Filter: Category, Visibility, Status
   Scoring: Capability, Location, Budget, Tags, Text Similarity, Priority
   → Engine Score
  │
  ▼
6. RANKING ENGINE
   Final Ranking = Match Score + Reputation + Response + Completion
                  + Activity + Verification + Premium Boost
                  − Cancel Penalty − Expired Penalty
  │
  ▼
7. USER MEMILIH HASIL
   Lihat: Foto, Dokumen, Rating, Review, Badge Verified, Statistik, Trust Score
  │
  ▼
8. INVITATION ENGINE
   Buat Opportunity invite, status PENDING
   Simpan: Match Score, Breakdown, Message → Notification
  │
  ├──▶ ACCEPT ──▶ Tampilkan Kontak ──▶ NEGOTIATION ──▶ DEAL ──▶ IN PROGRESS ──▶ [FRAUD CHECK] ──▶ COMPLETED
  │                                                                                    │
  │                                                                          risk score tinggi?
  │                                                                          → BLOCKED, admin review
  └──▶ REJECT ──▶ Selesai                                          CANCELLED / EXPIRED
```

## Pemetaan ke Kode

| Langkah Flowchart | Modul/Endpoint |
|---|---|
| Layer 0: Mulai diagnosis | `POST /api/v1/decision/inquiries` |
| Layer 0: Jawab klarifikasi | `POST /api/v1/decision/inquiries/:id/answers` |
| Layer 0: Cek status diagnosis | `GET /api/v1/decision/inquiries/:id` |
| Layer 0: Ambil rekomendasi/data-gap alert | `GET /api/v1/decision/inquiries/:id/recommendations` |
| Layer 0: Kelola basis pengetahuan (admin) | `GET/POST /api/v1/decision/knowledge` |
| 1. Register/Login | `POST /api/auth/register`, `GET /api/auth/me` |
| 2. Verification | `POST /api/verification-documents`, `PATCH /api/verification-documents/:id/review` |
| 3. Create Opportunity | `POST /api/opportunities` |
| 4. Boost | `POST /api/boosts/:opportunityId/activate` |
| 5+6. Matching + Ranking | `GET /api/matching/:opportunityId/run` |
| 7. User memilih hasil | `GET /api/profiles/:id`, `GET /api/reviews/profile/:profileId` |
| 8. Invitation | `POST /api/invitations`, `PATCH /api/invitations/:id/respond` |
| Negotiation → Deal | `PATCH /api/invitations/deals/:id` |
| Fraud Check (gerbang sebelum COMPLETED) | `src/modules/fraud/fraud.service.js` → `runFraudChecks()`, dipanggil dari `deal.controller.js` |
| Review insiden fraud (admin) | `GET /api/fraud-flags`, `PATCH /api/fraud-flags/:id/review` |
