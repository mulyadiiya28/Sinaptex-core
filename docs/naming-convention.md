# Naming Convention

## File & Folder
- Folder module: `kebab-case` singular per domain, mis. `opportunity/`, `invitation/`
- File kode: `<domain>.<layer>.js` — layer: `controller`, `service`, `routes`, `validation`
- File dokumen: `kebab-case.md`

## Kode (JavaScript)
- Variabel & fungsi: `camelCase` (`computeMatchScore`, `matchScore`)
- Class: `PascalCase` (`ApiError`)
- Konstanta tetap: `UPPER_SNAKE_CASE` (`ALLOWED_MIME`, `WEIGHTS`)
- Boolean: awali `is`/`has`/`should` (`isCompany`, `hardFilterPassed`)

## Database (Prisma)
- Model: `PascalCase` singular (`Opportunity`, `VerificationDocument`)
- Field: `camelCase` (`ownerId`, `createdAt`)
- Nama tabel fisik (`@@map`): `snake_case` plural (`opportunities`, `verification_documents`)
- Enum: `PascalCase` untuk nama enum, `UPPER_SNAKE_CASE` untuk value (`OpportunityStatus.ACTIVE`)

## API
- Path: `kebab-case` plural noun (`/verification-documents`, `/opportunities`)
- Query param: `camelCase` (`categoryId`, `limit`)
- Body field: `camelCase`, sama seperti nama field Prisma supaya konsisten end-to-end

## Git
- Branch: `feature/<kebab-case-deskripsi>`, `fix/<kebab-case-deskripsi>`
- Commit: lihat `CONTRIBUTING.md` (Conventional Commit)
