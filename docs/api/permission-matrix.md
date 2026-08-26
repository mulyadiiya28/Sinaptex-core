# Permission Matrix

Legenda: OK = boleh · OWN = boleh, tapi dibatasi kepemilikan/partisipasi (lihat catatan) · X = tidak boleh

`Guest` = tanpa token. `User` = punya token valid, tanpa `BusinessRole` khusus.
`Admin` = punya `BusinessRole = ADMIN`.

## Content / CMS

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET /content/pages/:slug`, `GET /content/faq` | OK | OK | OK | Publik, HANYA status `PUBLISHED` |
| `GET/PUT /admin/content/pages/:slug` | X | X | OK | |
| `GET/POST/PATCH/DELETE /admin/content/faq*` | X | X | OK | |

## Entry Point & Identity

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `POST /intent` | OK | OK | OK | Publik, `optionalAuth` — hasil dipersonalisasi kalau login |
| `POST /auth/register` | X | OK | OK | Butuh token Supabase valid (`verifySupabaseToken`, bukan `requireAuth` penuh) |
| `GET /auth/me` | X | OK | OK | |
| `GET /profiles/:id` | X | OK | OK | |
| `PATCH /profiles/me` | X | OWN | OWN | Hanya profile sendiri |
| `POST /parties`, `GET /parties` | X | OWN | OWN | Buat/list Party milik sendiri |
| `GET /parties/:id` | OK | OK | OK | Publik |
| `PATCH /parties/:id`, `.../capabilities*` | X | OWN | OWN | Hanya pemilik Party |
| `POST /verification-documents` | X | OWN | OWN | Hanya untuk Party milik sendiri |
| `PATCH /verification-documents/:id/review` | X | X | OK | |

## Business

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET /opportunities`, `GET /opportunities/:id` | OK | OK | OK | Publik |
| `POST /opportunities` | X | OWN | OWN | Hanya Party milik sendiri |
| `PATCH /opportunities/:id` | X | OWN | OWN | Hanya pemilik Opportunity |
| `GET /matching/:id/run` | X | OK | OK | |
| `POST /invitations` | X | OWN | OWN | Harus jadi salah satu pihak di Match |
| `PATCH /invitations/:id/respond` | X | OWN | OWN | Hanya penerima invitation |
| `PATCH /invitations/deals/:id` | X | OWN | OWN | Hanya pihak terkait di Deal |

## Communication

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `POST /chat/conversations` | X | OWN | OWN | Gating membership tergantung `originType` — lihat `chat.policy.js` |
| `GET /chat/conversations`, `.../messages` | X | OWN | OWN | Hanya partisipan conversation |
| `POST /chat/conversations/:id/messages` | X | OWN | OWN | Hanya partisipan |
| `PATCH /chat/conversations/:id/read` | X | OWN | OWN | Hanya partisipan |
| WebSocket (semua event) | X | OWN | OWN | Sama seperti REST — auth di handshake |
| `GET /notifications/me`, `PATCH .../read` | X | OWN | OWN | Hanya notifikasi milik sendiri |

## Trust

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET /reviews/profile/:id` | OK | OK | OK | Publik — review `hidden: true` otomatis tidak muncul |
| `POST /reviews/deals/:dealId` | X | OWN | OWN | Hanya pihak di Deal yang `COMPLETED` |
| `POST /reports` | X | OWN | OWN | Melaporkan Profile lain |
| `GET /reports` | X | OWN | OWN | Laporan yang dibuat sendiri |

## Platform Operations (Admin)

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET /admin/dashboard` | X | X | OK | |
| `GET /admin/users`, `GET /admin/users/:id` | X | X | OK | |
| `PATCH /admin/users/:id/status` | X | X | OK | Suspend/ban ditegakkan di `requireAuth`, langsung berlaku request berikutnya |
| `GET /admin/opportunities`, `PATCH .../status` | X | X | OK | Moderasi, bebas dari cek kepemilikan |
| `GET /admin/reviews`, `PATCH .../visibility` | X | X | OK | |
| `GET /admin/reports`, `PATCH /admin/reports/:id` | X | X | OK | |
| `GET /admin/transactions` | X | X | OK | Lintas semua user, bukan cuma diri sendiri |

## Monetization

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET /membership/plans` | OK | OK | OK | Publik |
| `GET /membership/me`, `POST /membership/checkout` | X | OWN | OWN | Diri sendiri |
| `POST /membership/webhook/:provider` | — | — | — | Bukan user — dipanggil server payment gateway, keamanan via signature |
| `GET /membership/transactions/me` | X | OWN | OWN | Diri sendiri |
| `POST /membership/dev-activate` | X | OWN | OWN | Diri sendiri, diblokir total di production |
| `POST/GET /pricing/plans/:planId` | X | X | OK | |
| `GET /boosts/plans` | OK | OK | OK | Publik |
| `POST /boosts/:opportunityId/activate` | X | OWN | OWN | Hanya pemilik Opportunity |

## Dibekukan (kode aktif, akses tetap ditegakkan seperti biasa)

| Endpoint | Guest | User | Admin | Catatan |
|---|---|---|---|---|
| `GET/POST /fraud-flags*` | X | X | OK | |
| `POST /decision/inquiries`, `.../answers` | OK | OK | OK | Publik, `optionalAuth` |
| `GET/POST /decision/knowledge` | OK (GET) | OK (GET) | OK | POST admin only |
| `POST /business-diagnosis/sessions` | X | OWN | OWN | Butuh login (tarik data Party) |
| `GET/POST /business-diagnosis/knowledge` | OK (GET) | OK (GET) | OK | POST admin only |
| `PATCH /business-diagnosis/advisory/:id/publish` | X | X | OK | |

## Catatan

- Belum ada role di antara `User` dan `Admin` (mis. moderator) — kalau granularitas lebih
  halus dibutuhkan nanti, `BusinessRole` sudah berupa array per-Profile jadi tinggal tambah
  tipe role baru + `requireRole(...)` di route yang relevan, tidak perlu ubah skema besar.
- `OWN` di tabel ini SELALU berarti "dicek kepemilikan/partisipasi di level data", bukan role —
  dua user berbeda yang sama-sama `User` (bukan admin) tetap tidak bisa saling akses resource
  privat satu sama lain.
