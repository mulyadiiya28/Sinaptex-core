# Sequence Diagram — Matching → Invitation → Deal

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

## 2. Mengirim Invitation & Merespon

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
  │◀────────────────────────────────────────────────────────────── contact unlocked
```

## Catatan
- Semua step di atas terjadi sinkron dalam satu request/response (belum event-driven / queue).
- Rencana Phase 05/11: pindahkan `recomputePartyStats` & notifikasi ke event bus/queue supaya
  request matching tidak menunggu proses berat secara sinkron.
