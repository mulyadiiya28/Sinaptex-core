# Filosofi Inti: Business Decision Engine

> **Dokumen ini adalah "base knowledge" platform — prinsip di sini tidak boleh berubah
> hanya karena model AI di baliknya berganti.** Kalau suatu saat LLM yang dipakai diganti
> (GPT ke Claude, Claude ke model lain, dst), filosofi dan struktur data di dokumen ini
> yang menjaga platform tetap konsisten dan jujur ke pengguna.

## 1. Prinsip Utama: Cari Akar Masalah, Bukan Produk

Platform ini **bukan** katalog produk, marketplace software, atau direktori jasa.
Intinya adalah: **menemukan apa yang orang SEBENARNYA butuhkan**, lalu — dan hanya kalau
tersedia — menghubungkannya ke Need/Offer nyata di platform yang menjawab kebutuhan itu.

Ini mengikuti teori **Jobs-to-be-Done (JTBD)** dari Clayton Christensen: orang tidak
"membeli produk", mereka "mempekerjakan" (hire) sesuatu untuk menyelesaikan sebuah *Job*
dalam hidup/bisnis mereka.

| Yang orang sebut (permukaan) | Yang sebenarnya mereka butuhkan (Job) |
|---|---|
| "Saya butuh bor" | Lubang di dinding, supaya barang bisa terpasang kuat |
| "Saya butuh rumah" | Tempat berteduh **atau** pengakuan status sosial **atau** instrumen investasi |
| "Saya butuh CRM" | Follow-up pelanggan tidak bocor, supaya penjualan tidak hilang sia-sia |

Kolom kedua itulah yang disebut **RootProblem** dan **JobToBeDone** dalam skema database
(`prisma/schema.prisma`). Kolom pertama adalah **SolutionCategory** — istilah yang orang
pakai untuk mencari, tapi bukan tujuan akhirnya.

## 2. Berpikir Terbalik (Inversion Thinking)

Kebanyakan sistem rekomendasi dirancang untuk menjawab: *"Bagaimana caranya orang ini
berhasil menemukan produk yang bagus?"* Platform ini sengaja membalik pertanyaannya, sesuai
prinsip kuno *inversion* (populer lewat Charlie Munger: *"invert, always invert"*):

> **Bukan "bagaimana supaya orang sukses menemukan solusi", tapi "bagaimana supaya orang
> TIDAK GAGAL mengambil keputusan yang salah."**

Konsekuensi praktis dari prinsip ini terhadap desain engine:
- Engine **tidak** berusaha keras "menjual" sebuah kategori solusi begitu ada kecocokan
  tipis. Ia justru mengajukan pertanyaan klarifikasi ketika ambigu (lihat `ClarifyingQuestion`),
  karena rekomendasi yang salah lebih merugikan daripada rekomendasi yang terlambat.
- Engine **tidak** memaksakan sebuah SolutionCategory kalau basis pengetahuan tidak
  mendukungnya — lebih baik bilang "kami tidak tahu" daripada menyesatkan.
- Skor `confidenceScore` dan status `dataSufficiency` selalu ditampilkan eksplisit ke
  pengguna, bukan disembunyikan di balik jawaban yang percaya diri.

## 3. Anti-Halusinasi: Data Dulu, Baru Kesimpulan

Ini aturan yang **tidak bisa ditawar**:

1. **Diagnosis Job tidak pernah ditebak generatif.** `decision.service.js` mencari
   `SolutionCategory` lewat *keyword overlap* yang deterministik terhadap basis
   pengetahuan di database (`RootProblem` → `JobToBeDone` → `SolutionCategory`), bukan
   memanggil LLM untuk "mengarang" pemetaan setiap kali ada request.
2. **Kalau basis pengetahuan tidak punya data untuk permintaan tertentu, engine berhenti
   dan mengaku jujur** (`status: CLOSED_NO_DATA`, alert eksplisit) — bukan menciptakan
   jawaban supaya terlihat pintar.
3. **Rekomendasi akhir hanya menunjuk ke Opportunity yang benar-benar ada di platform.**
   Kalau Job sudah terdiagnosis tapi tidak ada Need/Offer nyata yang menjawabnya, engine
   membuat `DecisionRecommendation` dengan `isDataGapAlert: true` dan `opportunityId: null`
   — secara eksplisit bilang "kami tahu masalah Anda, tapi belum ada solusinya di sini",
   bukan merekomendasikan sesuatu yang tidak relevan supaya tetap terlihat "berguna".
4. **Basis pengetahuan adalah data terkurasi (admin-managed), bukan output model AI.**
   Ini yang membuatnya jadi *aset institusional* — kalau model AI di balik platform
   berganti sepenuhnya, `RootProblem`/`JobToBeDone`/`SolutionCategory` di database tidak
   ikut berubah atau hilang. Model AI boleh dipakai untuk hal lain (mis. menulis draft
   deskripsi Opportunity), tapi **bukan** untuk memutuskan pemetaan masalah→solusi inti.

## 4. Kenapa Ini di ATAS Matching Engine, Bukan Menggantikannya

```
User: "saya butuh CRM"
   │
   ▼
┌─────────────────────────────┐
│  BUSINESS DECISION ENGINE    │  <- diagnosis: "supaya follow-up tidak bocor"
│  (Phase 19)                  │     confidenceScore, dataSufficiency eksplisit
└──────────────┬────────────────┘
               │ Job yang terdiagnosis
               ▼
┌─────────────────────────────┐
│  MATCHING ENGINE (Phase 08)  │  <- cari Opportunity nyata yang relevan
│  + RANKING ENGINE            │     dengan Job itu (bukan literal kata "CRM")
└──────────────┬────────────────┘
               │
               ▼
      Opportunity nyata (kalau ada) ATAU data-gap alert (kalau tidak ada)
```

Matching Engine tetap dipakai apa adanya — tugasnya mencari & meranking Opportunity yang
cocok. Bedanya, sekarang ia mencari berdasarkan **Job yang sudah didiagnosis dulu**
(representasi kebutuhan sebenarnya), bukan langsung dari kata kunci mentah yang diketik
pengguna. Ini yang membuat platform "jujur dan bisa membantu jutaan manusia mengambil
keputusan berdasarkan data" — sesuai visi awal permintaan fitur ini.

## 5. Bagaimana Basis Pengetahuan Ini Tumbuh

Basis pengetahuan **tidak statis** — admin bisa menambah `RootProblem`/`JobToBeDone`/
`SolutionCategory`/`ClarifyingQuestion` baru lewat `POST /api/v1/decision/knowledge`
(lihat `docs/api-requests.md`). Setiap entri baru harus:

- Punya minimal satu `JobToBeDone` yang ditulis dalam format kanonik JTBD:
  *"Ketika [situasi], saya ingin [motivasi], supaya [hasil yang diinginkan]"*
- Kalau satu `SolutionCategory` punya lebih dari satu kemungkinan `JobToBeDone` (ambigu),
  **wajib** disertai `ClarifyingQuestion` untuk tiap Job supaya engine bisa membedakan
  mana yang relevan, bukan menebak.

## 6. Contoh Konkret yang Sudah Di-seed (`prisma/seed.js`)

| SolutionCategory | Ambigu? | Job(s) |
|---|---|---|
| Bor Listrik | Tidak (1 Job) | Melubangi permukaan keras untuk memasang sesuatu |
| Rumah / Properti | Ya (3 Job) | (1) Tempat berteduh, (2) Pengakuan status sosial, (3) Instrumen investasi |
| CRM Software | Tidak (1 Job) | Supaya follow-up pelanggan tidak bocor & penjualan tidak hilang |

## 7. Dari "Pencarian Produk" ke "Konsultan Bisnis" (Phase 20)

Bagian 1–6 di atas menjelaskan **Business Decision Engine (Phase 19)**: titik masuknya
adalah **permintaan permukaan** yang diketik user ("saya butuh CRM"), lalu dipetakan ke
Job lewat *keyword lookup* terhadap `SolutionCategory`.

Ada satu level lebih dalam yang tidak tertangkap pola itu: **gejala bisnis**. Orang jarang
bilang "saya butuh CRM" — yang lebih sering terjadi, mereka bilang **"penjualan saya
menurun"**. Kalimat itu bukan permintaan produk sama sekali, dan akar masalahnya bisa
macam-macam:

| Gejala | Kemungkinan akar masalah (harus dibuktikan dengan DATA) | Bentuk keluaran yang benar |
|---|---|---|
| Penjualan menurun | Skill closing sales rendah (conversion rate rendah + belum pernah training) | **MATCH_OPPORTUNITY** — cari penyedia pelatihan penjualan yang nyata ada di platform |
| Penjualan menurun | Sentimen pelanggan negatif (skor review rendah) | **ADVISORY_ONLY** — saran tindakan langsung, TIDAK dipaksa cari produk |

Ini yang melahirkan **Business Diagnosis Engine (Phase 20)**, lapisan konsultan yang
duduk **sejajar/di atas** Phase 19 — bedanya:

1. **Titik masuk:** `BusinessSymptom` (gejala), bukan `SolutionCategory` (istilah produk).
2. **Bukti diagnosis:** `DiagnosticFactor` — data TERUKUR (angka/kategori/boolean), sebisa
   mungkin ditarik otomatis dari histori nyata Party di platform ini (`metricsResolver.js`
   — mis. conversion rate, skor sentimen review), dan hanya jatuh ke input manual kalau
   platform belum punya cukup data. Ini yang membuat diagnosis lebih *grounded* daripada
   sekadar keyword dari kalimat bebas.
3. **Aturan deterministik, bukan black-box:** `DiagnosticRule` berisi kondisi eksplisit
   (mis. `conversionRate < 15 AND trainingHistory = false`) yang bisa diaudit siapa pun —
   bukan skor kepercayaan dari model AI yang tidak bisa dijelaskan.
4. **Keluaran TIDAK selalu produk.** `BusinessRootCause.recommendationType` bisa:
   - `ADVISORY_ONLY` — saran murni dari `AdvisoryContent` (bank saran terkurasi admin,
     boleh diawali draft AI tapi **wajib** direview & di-publish admin dulu — lihat
     `PATCH /business-diagnosis/advisory/:id/publish` — sebelum pernah ditampilkan ke user)
   - `MATCH_OPPORTUNITY` — baru di titik ini engine "turun" ke basis pengetahuan JobToBeDone
     Phase 19 (`BusinessRootCause.jobId`) untuk mencari Opportunity nyata
   - `HYBRID` — dua-duanya ditampilkan

Prinsip inti Phase 19 (Bagian 3: anti-halusinasi) berlaku sama persis di Phase 20:
- Kalau kombinasi data yang terkumpul tidak cocok dengan `DiagnosticRule` manapun di basis
  pengetahuan → status `INSUFFICIENT_DATA`, jujur mengaku, bukan menyimpulkan paksa.
- Kalau root cause-nya `ADVISORY_ONLY`/`HYBRID` tapi belum ada `AdvisoryContent` yang
  `PUBLISHED` → tetap tidak ditampilkan, walau draft-nya sudah ada.
- Kalau root cause-nya `MATCH_OPPORTUNITY`/`HYBRID` tapi tidak ada Opportunity nyata yang
  relevan → data-gap alert, bukan rekomendasi yang dipaksakan.

Singkatnya: **Phase 19 menjawab "apa yang sebenarnya Anda cari", Phase 20 menjawab
"apa yang sebenarnya salah dengan bisnis Anda, dan apakah itu memang butuh membeli
sesuatu sama sekali."**

## 8. Contoh Konkret Phase 20 (`prisma/seed.js`)

Gejala **"Penjualan Menurun"** dengan 3 `DiagnosticFactor`:
- Conversion Rate 30 Hari Terakhir (AUTO_PLATFORM, dari histori Invitation→Deal Party)
- Skor Sentimen Review 90 Hari Terakhir (AUTO_PLATFORM, dari rata-rata Review Party)
- Riwayat Pelatihan Penjualan Staff (MANUAL_INPUT — platform tidak melacak ini)

Dua `BusinessRootCause` yang bersaing, dibedakan oleh data mana yang benar-benar cocok:
1. **Keterampilan Closing Sales Rendah** (`conversionRate < 15% AND training = false`)
   → `MATCH_OPPORTUNITY` ke Job "butuh pelatihan penjualan karyawan"
2. **Sentimen Pelanggan Negatif** (`reviewSentiment < 60`)
   → `ADVISORY_ONLY`, saran "tanggapi review negatif dalam 24 jam..." — tidak ada produk
   yang direkomendasikan sama sekali.

Coba langsung: `POST /api/v1/business-diagnosis/sessions` dengan `symptomId` gejala ini
dan `partyId` milik akun Anda — kalau Party sudah punya histori Invitation/Deal/Review,
sebagian factor akan otomatis terisi (`autoResolvedFactors` di response), sisanya diminta
manual lewat `POST /business-diagnosis/sessions/:id/factors`.

