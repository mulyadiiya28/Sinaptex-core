# Entity Relationship Diagram (ERD)

Sumber kebenaran skema: [`prisma/schema.prisma`](../prisma/schema.prisma).
Generate diagram visual (opsional) dengan:
```bash
npx prisma-erd-generator   # atau tool sejenis, tambahkan sebagai devDependency
```

## Ringkasan Relasi (tekstual)

```
User 1—1 Profile
Profile 1—N BusinessRole
Profile 1—N Party (owner)
Party N—1 Category
Party N—N Capability   (lewat PartyCapability)
Party 1—N VerificationDocument
Profile 1—N VerificationDocument
Party 1—N Opportunity
Opportunity N—1 Category
Opportunity N—N Capability   (lewat OpportunityCapability)
Opportunity 1—1 OpportunityBoost
OpportunityBoost N—1 BoostPlan
Opportunity 1—N Media
Opportunity 1—N Match          (sebagai "need" ATAU "offer")
Match 1—1 Invitation
Invitation N—1 Opportunity (target)
Invitation N—1 Party (fromParty)
Invitation N—1 Party (toParty)
Invitation 1—1 Deal
Deal 1—N Review
Profile 1—N Review (sebagai reviewer)
Profile 1—N Review (sebagai reviewee)
Profile 1—N Notification
Party ···· N PartyRelationship (partyAId/partyBId — TANPA FK Prisma, lihat catatan di bawah)
Deal ···· N FraudFlag (dealId — TANPA FK Prisma)
```

## Catatan Desain

- `Match` menyimpan pasangan `needId`+`offerId` unik (`@@unique([needId, offerId])`) —
  hasil matching di-cache di sini supaya `Invitation` bisa merujuk skor & breakdown yang sama.
- `Party` adalah representasi perusahaan/individu yang melakukan bisnis; satu `Profile`
  (user login) bisa punya banyak `Party`.
- Skor reputasi (`reputationScore`, `responseScore`, dst) disimpan **cache** di `Profile`,
  dihitung ulang oleh `partyStats.service.js` setiap ada event yang relevan (deal selesai, review baru).

## Belum Ada di Skema Saat Ini (lihat Phase 04 checklist)
- Tabel master `Skill`, `Tag`, `Country/Province/City`, `Currency`, `Language`
- Tabel `PartyMember` (multi-anggota per Party)
- Tabel riwayat `Statistics`, `Activity`, `History` terpisah (saat ini derived on-the-fly)

## Fraud Detection Engine — `PartyRelationship` & `FraudFlag`
Kedua tabel ini sengaja **tidak** memakai `@relation` Prisma ke `Party`/`Deal` —
`partyAId`, `partyBId`, `dealId`, `invitationId` adalah string biasa, integritas
referensial ditangani di kode (`fraud.service.js`), bukan di level constraint DB.
Alasan: menghindari menambah lebih banyak named back-relation ke model `Party`
yang sudah punya banyak relasi. Lihat `docs/PROJECT_CHECKLIST.md` Phase 18 untuk detail.
