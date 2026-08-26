# Coding Standard

## Bahasa & Style
- Node.js CommonJS (`require`/`module.exports`) — konsisten di seluruh project
- 2 spasi indentasi, semicolon wajib
- Nama file: `kebab-case` untuk dokumen, `camelCase.js` / `<domain>.<layer>.js` untuk kode
  (contoh: `opportunity.controller.js`, `matching.service.js`)

## Struktur Controller
- Semua controller async dibungkus `asyncHandler` (lihat `src/utils/asyncHandler.js`)
- Controller tidak boleh langsung `throw new Error()` biasa — selalu `ApiError.xxx(...)`
- Controller tidak menaruh business logic kompleks — pindahkan ke `*.service.js` jika lebih dari
  ~30 baris logic atau dipakai lebih dari satu controller

## Validasi
- Setiap endpoint yang menerima body/query/params **wajib** punya Zod schema di
  `src/validations/<domain>.validation.js`, dipasang lewat `validate.middleware.js`
- Jangan validasi manual di controller (`if (!req.body.x) throw ...`) — itu tugas Zod

## Database
- Semua akses DB lewat Prisma Client (`src/config/prisma.js`), jangan raw SQL kecuali
  tidak ada padanan Prisma-nya (dan harus pakai `$queryRaw` dengan parameterized query)
- Transaksi multi-step wajib pakai `prisma.$transaction(...)`

## Error Handling
- Error yang terduga → `ApiError.badRequest/unauthorized/forbidden/notFound/conflict(...)`
- Error tak terduga otomatis ditangkap `error.middleware.js` dan disamarkan di production

## Response
- Selalu pakai `success()`/`created()` dari `src/utils/apiResponse.js`, jangan `res.json()` manual

## Komentar
- Beri komentar pada logic non-trivial (terutama scoring/ranking), jelaskan **alasan** bukan
  sekadar mengulang kode (lihat contoh di `matching.service.js`, `ranking.service.js`)

## Import Order (konvensi, tidak dipaksa lint saat ini)
1. Built-in Node / npm package pihak ketiga
2. Config (`../../config/*`)
3. Middleware
4. Utils
5. Service dari module sendiri/lain
