# API Request Examples — Business Matching Bridge

Dokumen ini berisi contoh request `curl` nyata + contoh response untuk setiap endpoint.
Untuk ringkasan tabel semua endpoint, lihat `docs/api-contract.md`. Untuk testing interaktif,
import `docs/postman/business-matching-bridge.postman_collection.json` ke Postman.

**Base URL:** `http://localhost:4000/api/v1` (alias tanpa versi: `/api/...` masih aktif)
**Auth:** `Authorization: Bearer <supabase_access_token>` — token didapat dari Supabase Auth
di sisi client, BUKAN dari API ini.

---

## 1. Auth

### Register (sinkron dari Supabase Auth)
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Budi Santoso",
    "phone": "+6281234567890",
    "bio": "Pemilik UMKM kopi asal Bandung",
    "location": "Bandung",
    "party": {
      "name": "Kopi Nusantara",
      "isCompany": true,
      "description": "Supplier biji kopi arabika kualitas ekspor",
      "location": "Bandung",
      "npwp": "01.234.567.8-901.000",
      "nib": "1234567890123"
    },
    "businessRoles": ["SUPPLIER"],
    "capabilityNames": ["kopi-arabika", "ekspor"]
  }'
```
**Response `201`:**
```json
{
  "success": true,
  "message": "Registration complete",
  "data": {
    "id": "prof-uuid",
    "fullName": "Budi Santoso",
    "verificationStatus": "UNVERIFIED",
    "businessRoles": [{ "role": "SUPPLIER", "partyId": "party-uuid" }],
    "parties": [{ "id": "party-uuid", "name": "Kopi Nusantara", "verificationStatus": "UNVERIFIED" }],
    "user": { "id": "user-uuid", "email": "budi@example.com" }
  }
}
```

### Get Me
```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

---

## 2. Profile

### Get Profile by Id
```bash
curl http://localhost:4000/api/v1/profiles/$PROFILE_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Update My Profile
```bash
curl -X PATCH http://localhost:4000/api/v1/profiles/me \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "bio": "Update bio terbaru", "location": "Jakarta" }'
```

---

## 3. Verification

### Upload Document
```bash
curl -X POST http://localhost:4000/api/v1/verification-documents \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "file=@/path/ke/nib.pdf" \
  -F "type=NIB" \
  -F "partyId=$PARTY_ID"
```
**Response `201`:**
```json
{
  "success": true,
  "message": "Document uploaded, pending review",
  "data": {
    "id": "doc-uuid",
    "type": "NIB",
    "fileUrl": "https://res.cloudinary.com/.../nib.pdf",
    "status": "PENDING"
  }
}
```

### List My Documents
```bash
curl http://localhost:4000/api/v1/verification-documents/me \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Review Document (Admin)
```bash
curl -X PATCH http://localhost:4000/api/v1/verification-documents/$DOC_ID/review \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "VERIFIED" }'
```

---

## 4. Opportunity

### Create Opportunity (NEED)
```bash
curl -X POST http://localhost:4000/api/v1/opportunities \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "partyId": "'"$PARTY_ID"'",
    "type": "NEED",
    "title": "Butuh supplier kopi arabika kualitas ekspor",
    "description": "Mencari supplier biji kopi arabika kualitas ekspor untuk kafe di Bandung, kontrak jangka panjang.",
    "location": "Bandung",
    "budgetMin": 10000000,
    "budgetMax": 50000000,
    "tags": ["kopi", "f&b"],
    "priority": "HIGH",
    "visibility": "PUBLIC"
  }'
```

### List Opportunities (filter + sort + search)
```bash
curl "http://localhost:4000/api/v1/opportunities?type=OFFER&location=Bandung&tag=kopi&budgetMin=10000000&budgetMax=50000000&search=arabika&sortBy=createdAt&sortOrder=desc&page=1&limit=20"
```
**Response `200`:**
```json
{
  "success": true,
  "message": "OK",
  "data": [ { "id": "opp-uuid", "title": "Menjual biji kopi arabika ekspor", "type": "OFFER", "...": "..." } ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

### Get Opportunity Detail
```bash
curl http://localhost:4000/api/v1/opportunities/$OPPORTUNITY_ID
```

### Update Opportunity
```bash
curl -X PATCH http://localhost:4000/api/v1/opportunities/$OPPORTUNITY_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ACTIVE", "priority": "URGENT" }'
```

### Upload Media
```bash
curl -X POST http://localhost:4000/api/v1/opportunities/$OPPORTUNITY_ID/media \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "file=@/path/ke/foto-produk.jpg"
```

---

## 5. Boost

### List Plans
```bash
curl http://localhost:4000/api/v1/boosts/plans
```
**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "type": "FREE", "priorityWeight": 0, "price": 0, "durationDays": 3650 },
    { "type": "BASIC", "priorityWeight": 25, "price": 49000, "durationDays": 7 },
    { "type": "PREMIUM", "priorityWeight": 60, "price": 149000, "durationDays": 14 },
    { "type": "VIP", "priorityWeight": 100, "price": 399000, "durationDays": 30 }
  ]
}
```

### Activate Boost
```bash
curl -X POST http://localhost:4000/api/v1/boosts/$OPPORTUNITY_ID/activate \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "planType": "PREMIUM", "paymentStatus": "PAID" }'
```

---

## 6. Matching + Ranking Engine

```bash
curl "http://localhost:4000/api/v1/matching/$OPPORTUNITY_ID/run?limit=10" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```
**Response `200`:**
```json
{
  "success": true,
  "message": "Found 3 ranked candidates",
  "data": [
    {
      "matchId": "match-uuid",
      "opportunity": {
        "id": "opp-uuid-2",
        "title": "Menjual biji kopi arabika ekspor",
        "type": "OFFER",
        "location": "Bandung",
        "party": { "id": "party-uuid-2", "name": "Arabika Prima", "verificationStatus": "VERIFIED" }
      },
      "matchScore": 87.5,
      "finalScore": 74.2,
      "matchBreakdown": {
        "capabilityMatch": 1, "location": 1, "budget": 0.9, "tags": 1, "textSimilarity": 0.6, "priority": 0.75
      },
      "rankingBreakdown": {
        "matchScore": 30.63, "reputationScore": 13.5, "responseScore": 7,
        "completionScore": 13.5, "activityScore": 2.5, "verificationScore": 10,
        "premiumBoost": 6, "cancelPenalty": 0, "expiredPenalty": 0
      }
    }
  ]
}
```
> `matchId` di atas dipakai untuk `POST /invitations` berikutnya.

---

## 7. Invitation

### Create Invitation
```bash
curl -X POST http://localhost:4000/api/v1/invitations \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "matchId": "'"$MATCH_ID"'", "message": "Halo, produk Anda cocok dengan kebutuhan kami." }'
```

### List My Invitations
```bash
curl http://localhost:4000/api/v1/invitations/me \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Respond (Accept/Reject)
```bash
curl -X PATCH http://localhost:4000/api/v1/invitations/$INVITATION_ID/respond \
  -H "Authorization: Bearer $COUNTERPARTY_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "action": "ACCEPT" }'
```
**Response `200` (saat ACCEPT):**
```json
{
  "success": true,
  "message": "Invitation accepted",
  "data": {
    "invitation": { "id": "inv-uuid", "status": "ACCEPTED" },
    "deal": { "id": "deal-uuid", "status": "NEGOTIATION" },
    "contact": {
      "fromParty": { "name": "Kopi Nusantara", "location": "Bandung" },
      "toParty": { "name": "Arabika Prima", "location": "Bandung" }
    }
  }
}
```

---

## 8. Deal (state machine)

```bash
# NEGOTIATION -> DEAL
curl -X PATCH http://localhost:4000/api/v1/invitations/deals/$DEAL_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "DEAL", "agreedTerms": { "price": 45000000, "quantityKg": 500 }, "notes": "Sepakat harga & kuantitas" }'

# DEAL -> IN_PROGRESS
curl -X PATCH http://localhost:4000/api/v1/invitations/deals/$DEAL_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "IN_PROGRESS" }'

# IN_PROGRESS -> COMPLETED (lewat Fraud Detection Engine)
curl -X PATCH http://localhost:4000/api/v1/invitations/deals/$DEAL_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "COMPLETED", "notes": "Barang sudah diterima dan sesuai" }'
```

**Response `409` kalau Fraud Detection Engine memblokir:**
```json
{
  "success": false,
  "message": "Deal tidak bisa diselesaikan: terdeteksi indikasi aktivitas tidak wajar antara kedua party. Menunggu peninjauan admin (lihat FraudFlag).",
  "details": {
    "riskScore": 100,
    "findings": [
      {
        "reasonCode": "SAME_OWNER",
        "severity": "CRITICAL",
        "detail": "Party \"Kopi Nusantara\" dan \"Kopi Nusantara Cabang 2\" dimiliki oleh profile yang sama (prof-uuid)."
      }
    ]
  }
}
```

```bash
# Cancel
curl -X PATCH http://localhost:4000/api/v1/invitations/deals/$DEAL_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "CANCELLED", "cancelReason": "Supplier tidak bisa memenuhi kuantitas" }'
```

---

## 9. Review

```bash
curl -X POST http://localhost:4000/api/v1/reviews/deals/$DEAL_ID \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "revieweeId": "'"$COUNTERPARTY_PROFILE_ID"'", "rating": 5, "comment": "Kualitas kopi sangat baik, pengiriman tepat waktu." }'

curl http://localhost:4000/api/v1/reviews/profile/$PROFILE_ID
```

---

## 10. Notification

```bash
curl http://localhost:4000/api/v1/notifications/me \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

curl -X PATCH http://localhost:4000/api/v1/notifications/$NOTIFICATION_ID/read \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

---

## 11. Fraud (Admin only — butuh BusinessRole `ADMIN`)

```bash
curl "http://localhost:4000/api/v1/fraud-flags?status=PENDING_REVIEW" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"

curl http://localhost:4000/api/v1/fraud-flags/$FLAG_ID \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"

curl -X PATCH http://localhost:4000/api/v1/fraud-flags/$FLAG_ID/review \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "CONFIRMED", "note": "Terbukti kedua party dimiliki orang yang sama." }'
```

---

## 12. Business Decision Engine (root-cause / Jobs-to-be-Done)

> Duduk DI ATAS Matching Engine. Diagnosis dulu kebutuhan sebenarnya, baru cari Opportunity
> nyata yang menjawabnya. Lihat `docs/business-decision-philosophy.md`. Endpoint ini publik
> (`Authorization` opsional — kalau disertakan, inquiry dikaitkan ke profile yang login).

### Mulai Diagnosis (contoh: kasus AMBIGU — "rumah")
```bash
curl -X POST http://localhost:4000/api/v1/decision/inquiries \
  -H "Content-Type: application/json" \
  -d '{ "statedWant": "saya lagi cari rumah" }'
```
**Response `201`** (ambigu → butuh klarifikasi, TIDAK langsung menyimpulkan):
```json
{
  "success": true,
  "message": "Inquiry started",
  "data": {
    "inquiry": { "id": "inq-uuid", "statedWant": "saya lagi cari rumah", "status": "OPEN", "dataSufficiency": "INSUFFICIENT" },
    "alert": null,
    "pendingQuestions": [
      { "id": "q1-uuid", "jobId": "job-shelter-uuid", "question": "Apakah Anda saat ini belum punya tempat tinggal tetap?" },
      { "id": "q2-uuid", "jobId": "job-shelter-uuid", "question": "Apakah properti ini untuk ditinggali sendiri/keluarga, bukan disewakan?" },
      { "id": "q3-uuid", "jobId": "job-status-uuid", "question": "Apakah lokasi/prestise lingkungan jadi pertimbangan utama Anda?" },
      { "id": "q5-uuid", "jobId": "job-investment-uuid", "question": "Apakah Anda berencana menyewakan atau menjual kembali properti ini?" }
    ],
    "candidateJobCount": 3
  }
}
```

### Jawab Klarifikasi
```bash
curl -X POST http://localhost:4000/api/v1/decision/inquiries/$INQUIRY_ID/answers \
  -H "Content-Type: application/json" \
  -d '{ "questionId": "q1-uuid", "answer": "Ya, saya belum punya tempat tinggal tetap" }'

curl -X POST http://localhost:4000/api/v1/decision/inquiries/$INQUIRY_ID/answers \
  -H "Content-Type: application/json" \
  -d '{ "questionId": "q2-uuid", "answer": "Ya, untuk ditinggali keluarga sendiri" }'
```
**Response `200`** (setelah cukup jawaban, `status` berubah jadi `DIAGNOSED`):
```json
{
  "success": true,
  "data": {
    "inquiry": {
      "id": "inq-uuid",
      "diagnosedJobId": "job-shelter-uuid",
      "diagnosedJob": { "statement": "Ketika saya belum punya tempat tinggal tetap, saya ingin unit hunian yang aman dan nyaman, supaya saya dan keluarga punya tempat berteduh." },
      "confidenceScore": 0.85,
      "dataSufficiency": "SUFFICIENT",
      "status": "DIAGNOSED"
    },
    "pendingQuestions": []
  }
}
```

### Ambil Rekomendasi
```bash
curl http://localhost:4000/api/v1/decision/inquiries/$INQUIRY_ID/recommendations
```
**Response `200` — kalau ADA Opportunity nyata:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "opportunityId": "opp-uuid",
        "isDataGapAlert": false,
        "confidence": 0.62,
        "reasoning": "Kebutuhan sebenarnya yang teridentifikasi: \"...supaya saya dan keluarga punya tempat berteduh.\" Opportunity \"Rumah subsidi siap huni Bandung\" oleh PT Griya Sejahtera relevan (kemiripan konten 73%)."
      }
    ]
  }
}
```
**Response `200` — kalau TIDAK ADA data (jujur, bukan mengarang):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "opportunityId": null,
        "isDataGapAlert": true,
        "confidence": 0.85,
        "reasoning": "Kebutuhan sebenarnya yang teridentifikasi: \"...supaya saya dan keluarga punya tempat berteduh.\" Namun saat ini belum ada Need/Offer di platform yang cocok. Kami memilih untuk tidak merekomendasikan apa pun daripada mengarang solusi yang tidak benar-benar tersedia."
      }
    ]
  }
}
```

### Contoh: kasus TIDAK AMBIGU ("bor listrik") — langsung terdiagnosis
```bash
curl -X POST http://localhost:4000/api/v1/decision/inquiries \
  -H "Content-Type: application/json" \
  -d '{ "statedWant": "cari bor listrik yang bagus" }'
```
Response langsung `status: "DIAGNOSED"` tanpa `pendingQuestions` — karena SolutionCategory
"Bor Listrik" cuma punya 1 Job yang dipetakan (tidak ambigu).

### Contoh: basis pengetahuan tidak punya data (jujur mengaku, bukan menebak)
```bash
curl -X POST http://localhost:4000/api/v1/decision/inquiries \
  -H "Content-Type: application/json" \
  -d '{ "statedWant": "saya butuh jasa katering pernikahan" }'
```
**Response `201`:**
```json
{
  "success": true,
  "data": {
    "inquiry": { "status": "CLOSED_NO_DATA", "dataSufficiency": "INSUFFICIENT" },
    "alert": "Kami belum punya basis pengetahuan untuk kebutuhan ini. Kami tidak akan menebak — silakan hubungi admin untuk menambahkan kategori baru, atau coba jelaskan dengan kata lain.",
    "pendingQuestions": []
  }
}
```

### Kelola Basis Pengetahuan (Admin)
```bash
curl http://localhost:4000/api/v1/decision/knowledge

curl -X POST http://localhost:4000/api/v1/decision/knowledge \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "rootProblem": { "name": "Butuh acara pernikahan berjalan lancar tanpa ribet" },
    "job": { "statement": "Ketika saya menyiapkan pernikahan, saya ingin urusan konsumsi tamu ditangani pihak profesional, supaya saya bisa fokus ke hal lain di hari besar itu." },
    "solutionCategory": { "name": "Jasa Katering Pernikahan", "keywords": ["katering", "wedding", "pernikahan", "catering"] },
    "relevance": 1,
    "clarifyingQuestions": []
  }'
```

---

## 13. Health

```bash
curl http://localhost:4000/api/health
```
**Response `200`:**
```json
{ "success": true, "message": "Business Matching Bridge API is up", "checks": { "database": "ok" }, "timestamp": "2026-08-01T09:20:00.000Z" }
```

---

## Format Error Standar

Semua error mengikuti format ini (lihat `src/middlewares/error.middleware.js`):
```json
{
  "success": false,
  "message": "Pesan error singkat",
  "details": "opsional, array/object detail (mis. hasil validasi Zod atau temuan fraud)"
}
```

| Status | Arti |
|---|---|
| 400 | Validasi gagal |
| 401 | Token tidak ada/invalid/expired |
| 403 | Tidak punya akses ke resource ini |
| 404 | Resource tidak ditemukan |
| 409 | Konflik (state transition tidak valid, duplikasi, atau Fraud Detection Engine memblokir) |
| 500 | Internal server error |
