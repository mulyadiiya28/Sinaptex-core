# Product Roadmap

> **Status: TEMPLATE — isi timeline & prioritas sesuai keputusan tim.**
> Referensi fase teknis lengkap ada di `docs/PROJECT_CHECKLIST.md`.

## Milestone 1 — MVP (selesai/sebagian)
- [x] Auth, Verification, Opportunity, Boost
- [x] Matching + Ranking Engine
- [x] Invitation → Deal workflow
- [x] Review & Notification (in-app)

## Milestone 2 — Hardening
- [ ] Testing (unit/integration/e2e)
- [ ] Observability (logging, error tracking)
- [ ] Auto-expire job (scheduler)
- [ ] Rate limit per-endpoint yang lebih granular

## Milestone 3 — Growth
- [ ] Notifikasi multi-channel (email/WA)
- [ ] Dashboard Admin & Analytics
- [ ] Payment gateway real untuk Boost
- [ ] Multi-member Party & RBAC penuh

## Milestone 4 — Scale
- [ ] Caching (Redis) untuk hasil matching
- [ ] Queue (BullMQ) untuk job berat (recompute stats, notifikasi)
- [ ] Search full-text / vector similarity untuk textSimilarity yang lebih akurat
