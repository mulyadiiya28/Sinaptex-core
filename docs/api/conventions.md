# API Conventions

Standar yang berlaku lintas endpoint. Kalau menambah endpoint baru, ikuti pola di sini
supaya konsisten — jangan bikin konvensi baru per endpoint.

## Pagination

Query param standar (lihat `src/shared/pagination.js`):

| Param | Default | Maks | Catatan |
|---|---|---|---|
| `page` | `1` | — | 1-indexed |
| `limit` | `20` | `100` | |

Response selalu punya blok `meta`:
```json
{ "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
```

*Cursor-based pagination belum dipakai* — untuk skala MVP saat ini, offset (`page`/`limit`)
cukup. Pertimbangkan cursor kalau salah satu tabel besar (mis. `Message`) mulai terasa
lambat di-offset jauh (page 500+).

## Filtering & Sorting

Konvensi (belum 100% seragam di semua endpoint — endpoint baru WAJIB ikut ini):

| Param | Contoh | Catatan |
|---|---|---|
| `search` | `?search=kopi arabika` | Free-text, biasanya `contains` case-insensitive di 1-2 kolom utama |
| `sortBy` | `?sortBy=createdAt` | Nama kolom, whitelist per-endpoint (jangan terima nama kolom bebas dari user) |
| `sortOrder` | `?sortOrder=desc` | `asc` \| `desc`, default `desc` |
| Filter spesifik domain | `?type=OFFER&categoryId=...` | Nama sesuai field-nya, tidak ada prefix khusus |

Endpoint referensi paling lengkap: `GET /opportunities` (lihat `docs/api-contract.md`).

## Idempotency

Endpoint yang **mengubah uang/status penting** dan rawan dobel klik WAJIB dukung header:

```
Idempotency-Key: <string unik dari client, mis. UUID v4>
```

**Baru diimplementasikan di:** `POST /membership/checkout` (lihat `MembershipTransaction.idempotencyKey`,
unique constraint di DB + fallback race-condition handling di `membership.service.js`).

**Kandidat berikutnya** (belum diimplementasikan, urutan prioritas): `POST /invitations` (kirim
undangan dobel), `POST /reviews/deals/:dealId` (review dobel — saat ini sudah tercegah oleh
`@@unique([dealId, reviewerId])` di skema, jadi risikonya lebih rendah).

**Perilaku saat key dipakai ulang:** request kedua dengan key yang sama mengembalikan
transaksi/response **yang sama** dengan status `201` (bukan error) — field `idempotentReplay: true`
di response body menandakan ini adalah replay, bukan transaksi baru.

## Versioning & Deprecation Policy

- Base URL versi: `/api/v1`. Alias tanpa versi `/api` masih aktif untuk kompatibilitas mundur
  (lihat `src/routes/index.js`) — **akan dihapus** setelah semua client migrasi ke `/api/v1`.
- **Breaking change** (ubah shape response, hapus field wajib, ubah semantik status code) WAJIB
  masuk `v2`, TIDAK boleh mengubah `v1` yang sedang berjalan.
- **Endpoint deprecated** (masih jalan, tapi ada penerusnya) ditandai dengan:
  - Header response `Deprecation: true`
  - Header response `Link: <path-pengganti>; rel="successor-version"`
  - Lihat `src/middlewares/deprecated.middleware.js`
- Contoh saat ini: `GET /opportunities`, `POST /decision/inquiries`, `POST /business-diagnosis/sessions`
  ditandai deprecated demi `POST /intent` sebagai pintu masuk tunggal (tetap 100% berfungsi,
  bukan dihapus).
- **Sunset** (endpoint benar-benar dimatikan): belum ada kebijakan formal karena belum ada
  client eksternal — akan ditentukan (mis. minimum 90 hari sejak ditandai deprecated) begitu
  ada API konsumen di luar tim sendiri.

## Rate Limiting

**Saat ini:** hanya rate limit global (`express-rate-limit`, lihat `throttle.config.js`),
belum per-endpoint. Response rate-limit bawaan `express-rate-limit` **belum** mengikuti format
error standar (`{success, code, message}`) — catatan ini disengaja didokumentasikan sebagai
gap yang diketahui, bukan diselesaikan sekarang (lihat rasionalnya di `PROJECT_CHECKLIST.md`).

**Rekomendasi limit per-endpoint** (dokumentasi target, ENFORCEMENT-nya menyusul):

| Endpoint | Limit yang disarankan |
|---|---|
| `POST /auth/register` | 5/menit per IP |
| `POST /membership/checkout` | 3/menit per user |
| `POST /opportunities/:id/media`, `POST /chat/conversations/:id/messages` (upload) | 20/menit per user |
| `POST /intent` | 30/menit per IP (endpoint publik, rawan disalahgunakan) |
| Lainnya | ikut limit global |

## Response Standar

Lihat `docs/api-contract.md` untuk shape lengkap (`success`/`code`/`message`/`data`/`meta`/`details`).
