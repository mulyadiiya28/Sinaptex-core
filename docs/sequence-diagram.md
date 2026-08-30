# Sequence Diagram — Matching → Invitation → Deal (dan Chat cepat)

## 1. Menjalankan Matching Engine

```
Client            Express API          Prisma/DB         Matching+Ranking Service
  │  GET /matching/:oppId/run  │                │                    │
  │ ───────────────────────────▶                │                    │
  │                             │  find source Opportunity            │
  │                             │ ──────────────▶│                    │
  │                             │◀────────────── │                    │
  │                             │  find candidates (opposite type)    │
  │                             │ ──────────────▶│                    │
  │                             │◀────────────── │                    │
  │                             │  hardFilter + computeMatchScore     │
  │                             │ ────────────────────────────────────▶
  │                             │  recomputePartyStats per candidate  │
  │                             │ ────────────────────────────────────▶
  │                             │  computeFinalScore (ranking)        │
  │                             │ ────────────────────────────────────▶
  │                             │  upsert Match rows                  │
  │                             │ ──────────────▶│                    │
  │◀─────────────────────────── │  ranked results + breakdown         │
```

## 2. Chat cepat dari Opportunity (FR-16 — revisi produk)

Tanpa melewati Invitation Accept. Anti-spam: rate limit conversation baru + pesan.

```
Party A (Client)      Express API           Prisma/DB          Party B
  │ POST conversation            │                  │              │
  │  { originType: OFFER|NEED,   │                  │              │
  │    opportunityId, recipient }│                  │              │
  │ ─────────────────────────────▶                  │              │
  │                               │ chat.policy:     │              │
  │                               │  - opportunity valid            │
  │                               │  - rate limit OK                │
  │                               │  - block check                  │
  │                               │  (membership TIDAK wajib)       │
  │                               │ create Conversation + Message   │
  │                               │ ─────────────────▶│              │
  │◀───────────────────────────── │  conversation     │  notif / WS  │
  │                                                    │◀─────────────│
```

Cold DM (`originType: PROFILE`) tetap ketat (member / verified / rate limit sangat ketat).

## 3. Mengirim Invitation & Merespon (jalur formal → Deal)

```
Party A (Client)      Express API           Prisma/DB          Party B (Client)
  │ POST /invitations {matchId}  │                  │                   │
  │ ─────────────────────────────▶                  │                   │
  │                               │ load Match+parties│                   │
  │                               │ ─────────────────▶│                   │
  │                               │ create Invitation  │                   │
  │                               │ ─────────────────▶│                   │
  │                               │ create Notification│                   │
  │                               │ ─────────────────▶│                   │
  │◀───────────────────────────── │  invitation (PENDING)                 │
  │                                                    │                   │
  │                                                    │  GET /notifications/me
  │                                                    │◀──────────────────│
  │                                                    │  PATCH /invitations/:id/respond {ACCEPT}
  │                                                    │◀──────────────────│
  │                               │ update Invitation → ACCEPTED           │
  │                               │ create Deal (NEGOTIATION)              │
  │                               │ ─────────────────▶│                   │
  │                               │ create Notification (to Party A)       │
  │◀────────────────────────────────────────────────────────────── Deal aktif
```

## Catatan
- Chat cepat (bagian 2) dan Invitation (bagian 3) **paralel**, bukan serial wajib.
- Semua step di atas terjadi sinkron dalam satu request/response (belum event-driven / queue),
  kecuali broadcast chat lewat Socket.IO / event bus.
- Rencana Phase 05/11: pindahkan `recomputePartyStats` & notifikasi ke event bus/queue supaya
  request matching tidak menunggu proses berat secara sinkron.
- Detail keputusan: `docs/product-decisions-offer-chat.md`.
