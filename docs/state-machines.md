# State Machines

Diagram formal untuk semua entitas yang punya status/lifecycle. Ini business process
inti platform — dirapikan terpisah dari `flowchart.md` (alur end-to-end) supaya lebih mudah
dijadikan rujukan saat implementasi/testing transisi status.

## Opportunity

```
DRAFT --publish--> ACTIVE --+--close---> CLOSED
                             +--match---> MATCHED
                             +--expiresAt lewat--> EXPIRED (job expireOpportunities)
```
Transisi saat ini: `PATCH /opportunities/:id` (manual, bebas set status apa pun oleh
pemilik) + job `expireOpportunities` (otomatis, ACTIVE->EXPIRED). Belum ada validasi
transisi eksplisit (beda dari Deal/Invitation di bawah) — dicatat sebagai gap, lihat
`PROJECT_CHECKLIST.md` MVP Phase 5/6.

## Invitation

```
PENDING --accept--> ACCEPTED --(otomatis buat Deal berstatus NEGOTIATION)
        --reject--> REJECTED
        --14 hari tanpa respons (job expireInvitations)--> EXPIRED
```
Endpoint: `PATCH /invitations/:id/respond` (`action: ACCEPT | REJECT`). Sekali `ACCEPTED`/
`REJECTED`/`EXPIRED`, status final — tidak ada transisi balik.

## Deal

```
NEGOTIATION --> DEAL --> IN_PROGRESS --> COMPLETED   (final)
     |            |            |
     v            v            v
 CANCELLED    CANCELLED    CANCELLED                  (final)
     |            |
     v            v
  EXPIRED      EXPIRED                                (final)
```
Endpoint: `PATCH /invitations/deals/:id` (`status: ...`). Transisi divalidasi ketat lewat
tabel `TRANSITIONS` di `deal.controller.js` — request ke status yang tidak diizinkan dari
status saat ini ditolak `409 CONFLICT`.

**Gerbang khusus sebelum `COMPLETED`:** Fraud Detection Engine (`runFraudChecks()`) wajib
lolos dulu — kalau risk score tinggi, transisi diblokir `409 FRAUD_DETECTED` sampai admin
meninjau `FraudFlag` terkait (lihat modul `fraud/`, dibekukan tapi kode tetap aktif).

## Membership

```
INACTIVE --payment PAID (webhook)--> ACTIVE --expiresAt lewat (job expireMemberships)--> EXPIRED
                                         ^                                                  |
                                         +------------- renewal (checkout ulang) -----------+
```
`Membership.status` HANYA berubah lewat `membershipService` — tidak ada endpoint yang
mengizinkan user set status langsung (kecuali `dev-activate`, diblokir di production).

## MembershipTransaction

```
PENDING --webhook: settlement/capture(accept)--> PAID       (final)
        --webhook: deny/cancel/failure---------> FAILED     (final)
        --webhook: expire----------------------> EXPIRED     (final)
        --gateway gagal dipanggil saat checkout-> FAILED     (final)
```
**Idempotent**: begitu masuk status final (`PAID`/`FAILED`/`EXPIRED`/`CANCELLED`), webhook
berikutnya untuk `order_id` yang sama di-no-op, tidak reprocess (lihat
`handlePaymentWebhook()` di `membership.service.js` — perbaikan bug dari review sebelumnya:
payment gateway seperti Midtrans memang mengirim notifikasi retry, jadi tanpa guard ini
`Membership.expiresAt` bisa molor berkali-kali dari notifikasi yang sama).

## VerificationDocument

```
UNVERIFIED --upload--> PENDING --admin approve--> VERIFIED   (final)
                               --admin reject---> REJECTED   (bisa upload ulang -> PENDING lagi)
```
Status agregat di `Profile`/`Party` (`verificationStatus`) dihitung ulang dari SEMUA dokumen
terkait (`recomputeAggregateStatus()`) — bukan field independen.

## FraudFlag (dibekukan, endpoint tetap aktif)

```
PENDING_REVIEW --admin: CONFIRMED--> CONFIRMED   (final)
               --admin: DISMISSED--> DISMISSED   (final, cache SUSPECTED_COLLUSION dihapus)
```

## BusinessDiagnosis (dibekukan, endpoint tetap aktif)

```
DATA_COLLECTION --semua factor rule lengkap & match--> DIAGNOSED
                --semua factor lengkap, TIDAK ADA rule match--> INSUFFICIENT_DATA (final)
```
`DIAGNOSED` lalu lanjut ke `RECOMMENDED` setelah `decideForRootCause()` dipanggil (bukan
field status terpisah, dicek dari ada/tidaknya `BusinessDiagnosisRecommendation`).

## AdvisoryContent (dibekukan, endpoint tetap aktif)

```
DRAFT --admin publish--> PUBLISHED
```
Draft (termasuk `authorType: AI_DRAFT`) TIDAK PERNAH ditampilkan ke user — hanya `PUBLISHED`
yang boleh muncul di rekomendasi.
