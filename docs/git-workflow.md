# Git Workflow

Model yang dipakai: **Trunk-based ringan / GitHub Flow** dengan tambahan `develop`
sebagai integrasi (lihat detail branch di `docs/branch-strategy.md`).

## Alur Kerja Harian

1. `git checkout develop && git pull`
2. `git checkout -b feature/nama-fitur`
3. Kerjakan perubahan, commit kecil & sering dengan Conventional Commit
4. `git push origin feature/nama-fitur`
5. Buka Pull Request ke `develop`, isi template PR
6. Setelah review approve + CI hijau → squash merge
7. Hapus branch fitur setelah merge

## Rilis ke Production

1. `develop` yang sudah stabil di-merge ke `main` lewat PR khusus rilis
2. Tag versi mengikuti SemVer: `vMAJOR.MINOR.PATCH`
3. Update `CHANGELOG.md` sebelum tag
4. Deploy dari `main` (lihat `docs/deployment-guide.md`)

## Hotfix Darurat

1. `git checkout -b hotfix/nama-bug main`
2. Perbaiki, commit, PR langsung ke `main`
3. Setelah merge ke `main`, merge balik ke `develop` supaya tidak hilang

## Aturan Commit
- Satu commit = satu perubahan logis (hindari commit raksasa campur banyak hal)
- Jangan commit `.env`, `node_modules/`, file secret (sudah di `.gitignore`)
- Commit message wajib lolos Commitlint (lihat `CONTRIBUTING.md`)
