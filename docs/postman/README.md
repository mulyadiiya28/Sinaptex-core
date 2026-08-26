# Postman Collection — Business Matching Bridge

## Cara Pakai

1. Buka Postman → **Import** → drag kedua file ini:
   - `business-matching-bridge.postman_collection.json`
   - `business-matching-bridge.postman_environment.json`
2. Pilih environment **"Business Matching Bridge - Local"** di pojok kanan atas Postman.
3. Dapatkan `accessToken`:
   - Sign up/sign in lewat Supabase Auth di sisi client (mis. `supabase.auth.signInWithPassword(...)`
     pakai `@supabase/supabase-js`), lalu ambil `session.access_token`.
   - Isi variable `accessToken` di environment Postman dengan token tsb.
   - Token Supabase biasanya berlaku ~1 jam — refresh kalau mulai dapat 401.
4. Jalankan folder secara berurutan (matching alur bisnis):
   ```
   01 - Auth (register)
   → 12 - Business Decision Engine (opsional, coba dulu diagnosis kebutuhan sebelum langsung bikin Opportunity)
   → 03 - Verification (opsional, upload dokumen)
   → 04 - Opportunity (buat NEED & OFFER dari 2 akun berbeda)
   → 05 - Boost (opsional)
   → 06 - Matching + Ranking (jalankan matching, salin matchId dari response)
   → 07 - Invitation (kirim & respond undangan)
   → 08 - Deal (NEGOTIATION → DEAL → IN_PROGRESS → COMPLETED)
   → 09 - Review
   → 10 - Notification
   → 11 - Fraud (khusus akun dengan BusinessRole ADMIN)
   ```
5. Setelah dapat response dari suatu request (mis. `partyId` dari Register, `matchId` dari
   Run Matching), salin nilainya ke variable environment terkait supaya request berikutnya
   otomatis terhubung — collection ini sengaja dirancang chainable lewat `{{variable}}`.

## Catatan

- **Server harus jalan lebih dulu**: `npm run dev` (lihat README utama project untuk setup
  Supabase & Cloudinary).
- Untuk mencoba alur **matching dua pihak**, register **2 akun berbeda** (2 Supabase user
  terpisah) — satu bikin Opportunity `NEED`, satu lagi `OFFER`, supaya Matching Engine
  punya pasangan untuk dicocokkan. Kalau memakai Party dari owner yang sama, Matching Engine
  akan otomatis mengecualikannya (lihat Fraud Detection Engine di README utama).
- Endpoint upload (`Upload Verification Document`, `Upload Opportunity Media`) memakai
  `multipart/form-data` — pilih file secara manual di tab **Body → form-data** pada Postman,
  field `file` sudah disiapkan tapi kosong.
- Folder **11 - Fraud** hanya bisa dipanggil oleh akun yang punya `BusinessRole = ADMIN`
  (assign manual lewat Prisma Studio/SQL kalau belum ada, karena belum ada endpoint self-service
  untuk promote ke admin — sengaja, demi keamanan).

## Alternatif: Swagger UI

Server juga menyediakan Swagger UI interaktif di `http://localhost:4000/api/docs` (spec masih
minim, JSDoc `@openapi` baru ditulis untuk beberapa modul — lihat `docs/api-contract.md`).
