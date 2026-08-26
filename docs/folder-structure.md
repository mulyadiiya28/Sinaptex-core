# Folder Structure

```
business-matching-bridge/
├── .github/                        # PR & issue templates
├── docs/                            # dokumentasi project (Phase 00)
├── prisma/
│   ├── schema.prisma                # sumber kebenaran skema DB
│   └── seed.js                      # seed boost plan + kategori
├── src/
│   ├── app.js                       # setup Express (middleware global, mount routes)
│   ├── server.js                    # entrypoint (listen + graceful shutdown)
│   ├── config/                      # env, prisma client, cloudinary, supabase
│   ├── middlewares/                 # auth, validate, upload, error
│   ├── utils/                       # apiError, apiResponse, asyncHandler, cloudinaryUpload
│   ├── validations/                 # Zod schema per domain
│   ├── routes/
│   │   └── index.js                 # aggregator semua module routes
│   └── modules/
│       ├── auth/
│       ├── profile/
│       ├── verification/
│       ├── opportunity/
│       ├── boost/
│       ├── matching/
│       ├── ranking/
│       ├── invitation/               # + deal.controller.js (nested domain)
│       ├── review/
│       └── notification/
├── package.json
├── .env.example
└── README.md
```

## Aturan Penempatan File Baru

| Jenis file | Lokasi |
|---|---|
| Endpoint/module bisnis baru | `src/modules/<nama>/<nama>.controller.js` + `.routes.js` |
| Validasi input | `src/validations/<nama>.validation.js` |
| Helper lintas-module | `src/utils/` |
| Konfigurasi service eksternal baru | `src/config/<service>.js` |
| Dokumen non-kode | `docs/` |

## Rencana Struktur Tambahan (belum ada, lihat Phase 05/06/11)
```
src/
  core/     # auth strategy, logger, cache, queue, event-bus, storage, mail (lintas-module)
  shared/   # pagination helper, constants, mapper generik
  jobs/     # cron job handlers (node-cron)
  queue/    # BullMQ queue + worker
  events/   # event listener (eventemitter2)
```
