# Contributing Guide

Terima kasih sudah berkontribusi ke **Business Matching Bridge**. Ikuti panduan berikut
supaya kontribusi mudah direview dan digabungkan.

## 1. Branch Strategy

- `main` — selalu deploy-able, dilindungi (protected branch)
- `develop` — integrasi fitur sebelum rilis ke `main`
- `feature/<nama-fitur>` — kerja fitur baru, cabang dari `develop`
- `fix/<nama-bug>` — perbaikan bug, cabang dari `develop` (atau `main` untuk hotfix)
- `hotfix/<nama>` — perbaikan darurat langsung dari `main`

## 2. Conventional Commit

Format: `<type>(<scope opsional>): <deskripsi singkat>`

Tipe yang dipakai:
| Tipe | Kapan dipakai |
|---|---|
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Perubahan dokumentasi saja |
| `style` | Format kode, tanpa ubah logika (whitespace, semicolon, dll) |
| `refactor` | Ubah struktur kode tanpa ubah perilaku |
| `perf` | Perubahan yang meningkatkan performa |
| `test` | Menambah/memperbaiki test |
| `chore` | Perubahan tooling, dependency, config |

Contoh:
```
feat(matching): tambah scoring berbasis lokasi
fix(invitation): cegah invitation dobel untuk match yang sama
docs(readme): update instruksi setup Supabase
```

Commit divalidasi otomatis oleh **Commitlint** + **Husky** pre-commit hook.

## 3. Alur Pull Request

1. Fork/branch dari `develop`
2. Pastikan `npm run lint` dan test (jika ada) lolos
3. Buka PR ke `develop`, isi template PR yang tersedia
4. Minimal 1 review approval sebelum merge
5. Squash merge, judul PR mengikuti conventional commit

## 4. Struktur Module Baru

Setiap module bisnis baru mengikuti pola di `src/modules/<nama>/`:
```
<nama>.controller.js   # handler request/response
<nama>.service.js      # logic kompleks (opsional, kalau controller mulai gemuk)
<nama>.routes.js        # definisi route Express
```
Validasi input ditaruh di `src/validations/<nama>.validation.js` (Zod schema).

## 5. Coding Standard

- Ikuti gaya kode yang sudah ada (lihat `docs/PROJECT_CHECKLIST.md` Phase 06 untuk shared components)
- Semua endpoint yang mutasi data wajib divalidasi Zod (`validate.middleware.js`)
- Jangan expose Prisma error mentah ke client — lempar lewat `ApiError`
- Gunakan `asyncHandler` untuk semua controller async

## 6. Melaporkan Bug / Request Fitur

Gunakan template di `.github/ISSUE_TEMPLATE/`.
