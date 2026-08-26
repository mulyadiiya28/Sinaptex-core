# Branch Strategy

| Branch | Fungsi | Proteksi |
|---|---|---|
| `main` | Selalu deploy-able, mencerminkan production | Protected, wajib PR + review + CI hijau |
| `develop` | Integrasi fitur sebelum rilis | Protected, wajib PR + CI hijau |
| `feature/<nama>` | Kerja fitur baru | Tidak, dihapus setelah merge |
| `fix/<nama>` | Perbaikan bug non-darurat | Tidak, dihapus setelah merge |
| `hotfix/<nama>` | Perbaikan darurat production | Tidak, PR langsung ke `main` |

## Diagram

```
main     ──●───────────────●───────────●──▶ (release tags: v0.1.0, v0.2.0, ...)
            \               \           \
develop      ●──●──●──●──●───●──●──●──●──●▶
              \  \      /        \    /
feature/x      ●──●────●          \  /
feature/y                          ●●
                                  hotfix/z (dari main, merge balik ke develop juga)
```

## Aturan Proteksi Branch (rekomendasi setting GitHub)
- `main` & `develop`: require pull request before merge, require status checks (CI), require
  minimal 1 approval, disallow force-push
- Branch fitur: bebas, tapi harus lolos CI sebelum bisa merge ke `develop`
