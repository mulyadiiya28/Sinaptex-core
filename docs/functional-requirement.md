# Functional Requirement Document (FRD)

Berikut requirement fungsional yang **sudah terimplementasi** di engine ini
(status: ✅), sebagai baseline. Tambahkan requirement baru di bagian bawah
sesuai kebutuhan bisnis.

## FR-01 Autentikasi & Registrasi ✅
- User register/login lewat Supabase Auth
- Sistem membuat Profile lokal, opsional Party, Business Role, dan Capability

## FR-02 Verifikasi ✅
- User/Party dapat upload dokumen (KTP, NIB, NPWP, Sertifikat, Lainnya) ke Cloudinary
- Status dokumen: UNVERIFIED → PENDING → VERIFIED/REJECTED
- Admin dapat approve/reject dengan alasan

## FR-03 Opportunity (Need/Offer) ✅
- Party dapat membuat Opportunity bertipe NEED atau OFFER
- Field: category, capability, location, budget range, tags, priority, visibility, media
- Party dapat mengubah status (draft/active/closed) & data Opportunity miliknya

## FR-04 Boost ✅
- Party dapat mengaktifkan paket boost (FREE/BASIC/PREMIUM/VIP) pada Opportunity
- Boost menaikkan priorityWeight yang memengaruhi urutan hasil matching

## FR-05 Matching Engine ✅
- Sistem mencari kandidat Opportunity berlawanan tipe (NEED↔OFFER)
- Hard filter: kategori, visibility, status
- Scoring: capability, location, budget, tags, text similarity, priority

## FR-06 Ranking Engine ✅
- Sistem menggabungkan matchScore dengan reputationScore, responseScore,
  completionScore, activityScore, verificationScore, boost, dikurangi penalty
- Breakdown skor dikembalikan agar hasil explainable

## FR-07 Invitation & Deal ✅
- User dapat mengirim Invitation dari hasil Match
- Penerima dapat Accept/Reject
- Accept membuka kontak & membuat Deal (NEGOTIATION)
- Deal dapat bertransisi: NEGOTIATION → DEAL → IN_PROGRESS → COMPLETED/CANCELLED

## FR-08 Review & Reputasi ✅
- Setelah Deal COMPLETED, kedua pihak dapat saling memberi rating & review
- Review memengaruhi reputationScore pihak yang direview

## FR-09 Notifikasi ✅ (in-app saja)
- Sistem membuat notifikasi in-app untuk event: invitation diterima/ditolak, deal berubah status

## FR-10 Fraud Detection Engine ✅
- Matching Engine mengecualikan kandidat yang dimiliki Profile yang sama (self-dealing lewat 2 Party berbeda)
- Sebelum Deal ditransisikan ke COMPLETED, sistem menjalankan pemeriksaan: owner sama, NPWP/NIB sama,
  dokumen verifikasi dengan hash identik dipakai 2 Party berbeda, konsentrasi deal tinggi antar 2 party
  yang sama, kecepatan penyelesaian deal yang mencurigakan
- Risk score di atas ambang batas (`blockThreshold`) memblokir penyelesaian Deal sampai admin meninjau
- Temuan di bawah ambang blokir tetap dicatat sebagai `FraudFlag` untuk ditinjau admin (`PENDING_REVIEW`)
- Admin dapat menandai `CONFIRMED` (fraud nyata) atau `DISMISSED` (false positive) lewat `/fraud-flags/:id/review`
- Job harian `fraudScan` memindai ulang deal 24 jam terakhir untuk menangkap pola yang baru terbentuk

---

## Requirement Baru (belum diimplementasi)

> Tambahkan di sini requirement yang belum ada, misal:

- [ ] FR-11 Auto-expire Opportunity/Invitation via scheduled job — *(sudah ada, lihat FR sebelumnya & Phase 11 checklist)*
- [ ] FR-12 Notifikasi Email/WhatsApp
- [ ] FR-13 Dashboard Admin untuk moderasi & statistik (termasuk dashboard FraudFlag)
- [ ] FR-14 Multi-member Party (bukan hanya 1 owner)
