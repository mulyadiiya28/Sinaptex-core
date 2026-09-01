/**
 * Standalone: publish / refresh legal CMS pages without full seed.
 *   node prisma/seed-legal-content.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LEGAL_PAGES = [
  {
    slug: 'syarat-ketentuan',
    title: 'Syarat & Ketentuan',
    content: `# Syarat & Ketentuan Penggunaan Sinaptex

**Versi:** 1.0  
**Berlaku:** sejak dipublikasikan di platform

Dokumen ini mengatur penggunaan layanan Sinaptex ("Platform"). Dengan mendaftar atau menggunakan Platform, Anda menyatakan setuju terhadap ketentuan berikut.

## 1. Definisi
- **Pengguna** adalah individu atau badan usaha yang memiliki akun terverifikasi.
- **Need / Offer** adalah posting kebutuhan atau penawaran bisnis di Platform.
- **Deal** adalah kesepakatan formal yang terbentuk setelah undangan bisnis diterima.
- **Membership** adalah langganan berbayar yang membuka kuota dan fitur tambahan.

## 2. Akun & verifikasi
1. Anda wajib memberikan data yang benar dan dapat diverifikasi.
2. Satu orang/badan usaha bertanggung jawab penuh atas aktivitas akunnya.
3. Sinaptex berhak menangguhkan atau menonaktifkan akun yang melanggar ketentuan, melakukan fraud, atau menyalahgunakan Platform.

## 3. Peran Platform
Sinaptex adalah **fasilitator matching dan komunikasi B2B**, bukan pihak dalam kontrak jual-beli antara Pengguna, kecuali secara eksplisit dinyatakan dalam fitur Escrow resmi.

## 4. Konten & perilaku
Dilarang memposting konten ilegal, menyesatkan, spam, penipuan, atau yang melanggar hak pihak ketiga. Pelaporan peer tersedia melalui fitur Report.

## 5. Membership & pembayaran
1. Harga paket mengikuti daftar di Platform pada saat checkout.
2. Aktivasi membership berbayar dilakukan setelah konfirmasi pembayaran dari payment gateway (Midtrans).
3. Kecuali diwajibkan hukum yang berlaku, biaya membership yang sudah aktif umumnya tidak dapat diganti rugi secara proporsional (non-refundable) — kebijakan detail dapat diperbarui oleh admin.

## 6. Chat & undangan
Chat dari Need/Offer dan undangan formal (Invitation) adalah jalur terpisah. Undangan yang diterima dapat membentuk Deal dengan state machine yang berlaku di Platform.

## 7. Escrow (jika digunakan)
Jika Pengguna mengaktifkan fitur escrow, dana ditahan sesuai alur hold → konfirmasi → release/refund/dispute yang terdokumentasi di API/UI. Sinaptex tidak menjamin hasil bisnis di luar mekanisme teknis Platform.

## 8. Batasan tanggung jawab
Platform disediakan "sebagaimana adanya". Sejauh diizinkan hukum, Sinaptex tidak bertanggung jawab atas kerugian tidak langsung, kehilangan peluang usaha, atau sengketa antar Pengguna di luar proses mediasi yang disediakan.

## 9. Perubahan ketentuan
Sinaptex dapat memperbarui dokumen ini. Versi terbaru selalu tersedia di halaman ini. Penggunaan berkelanjutan setelah perubahan dianggap sebagai penerimaan.

## 10. Hukum yang berlaku
Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa diupayakan diselesaikan secara musyawarah; jika gagal, melalui lembaga yang berwenang di wilayah hukum yang ditentukan Sinaptex.

## 11. Kontak
Pertanyaan terkait ketentuan ini: lihat halaman **Kontak** atau email resmi yang tertera di Platform.

> **Catatan:** Teks ini adalah kerangka operasional untuk go-live teknis. Untuk kepatuhan hukum penuh, lakukan review oleh konsultan hukum sebelum klaim formal kepada publik.
`,
  },
  {
    slug: 'kebijakan-privasi',
    title: 'Kebijakan Privasi',
    content: `# Kebijakan Privasi Sinaptex

**Versi:** 1.0

Kebijakan ini menjelaskan bagaimana Sinaptex mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi sesuai semangat **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** dan praktik industri yang wajar.

## 1. Data yang kami kumpulkan
- **Identitas akun:** email, nama, nomor telepon (opsional), foto profil.
- **Data bisnis:** nama party/perusahaan, lokasi, deskripsi, dokumen verifikasi (KTP/NPWP/NIB, dll.).
- **Aktivitas platform:** Need/Offer, chat metadata, undangan, deal, review, laporan.
- **Teknis:** log aplikasi, alamat IP, user agent, token sesi (via penyedia autentikasi).
- **Pembayaran:** diproses oleh payment gateway; Sinaptex menyimpan status transaksi, invoice, dan referensi gateway — bukan nomor kartu penuh.

## 2. Tujuan pemrosesan
- Menyediakan layanan matching, chat, membership, dan notifikasi.
- Verifikasi identitas dan pencegahan fraud.
- Pemrosesan pembayaran dan aktivasi langganan.
- Keamanan, audit, dan pemenuhan kewajiban hukum.
- Peningkatan produk (analisis agregat, non-identifying jika memungkinkan).

## 3. Dasar pemrosesan
Persetujuan (registrasi/penggunaan), pelaksanaan kontrak layanan, kepentingan sah operasional keamanan, dan kewajiban hukum.

## 4. Penyimpanan & keamanan
Data disimpan pada infrastruktur cloud (termasuk database terkelola dan object storage). Akses dibatasi peran; komunikasi API mengandalkan HTTPS pada lingkungan production.

## 5. Berbagi data
Data dapat dibagikan kepada:
- Penyedia infrastruktur (hosting, database, storage, email),
- Payment gateway untuk penyelesaian transaksi,
- Otoritas jika diwajibkan hukum.

Kami tidak menjual data pribadi kepada pihak ketiga untuk pemasaran pihak ketiga tanpa dasar yang sah.

## 6. Hak subjek data
Sesuai UU PDP, Anda dapat meminta akses, koreksi, penghapusan (dengan batasan hukum/operasional), pembatasan, dan informasi terkait pemrosesan melalui kanal kontak resmi.

## 7. Retensi
Data disimpan selama akun aktif dan selama diperlukan untuk tujuan di atas atau kewajiban hukum. Setelah akun dihapus/dinonaktifkan, data dapat dianonimkan atau dihapus sesuai kebijakan retensi internal.

## 8. Cookie / token
Platform web/mobile klien dapat menyimpan token sesi. Kelola melalui pengaturan aplikasi/peramban Anda.

## 9. Perubahan
Kebijakan dapat diperbarui; versi terbaru dipublikasikan di halaman ini.

## 10. Kontak privasi
Hubungi kami melalui halaman **Kontak** untuk permintaan terkait data pribadi.

> **Catatan:** Kerangka ini mendukung go-live teknis. Sesuaikan dengan DPO/konsultan privasi untuk pernyataan formal publik.
`,
  },
  {
    slug: 'kontak',
    title: 'Kontak',
    content: `# Kontak Sinaptex

Kami siap membantu pertanyaan produk, akun, membership, dan laporan penyalahgunaan.

## Kanal
- **Email dukungan:** support@sinaptex.id *(ganti dengan email production Anda)*
- **Laporan keamanan:** security@sinaptex.id *(opsional)*
- **Melalui aplikasi:** fitur Report pada percakapan / profil

## Waktu respons
Hari kerja, umumnya 1–2×24 jam (dapat lebih lama pada volume tinggi).

## Alamat operasional
*(Isi alamat badan usaha / domisili legal setelah final)*
`,
  },
  {
    slug: 'tentang-kami',
    title: 'Tentang Kami',
    content: `# Tentang Sinaptex

Sinaptex adalah platform **B2B matchmaking** yang menghubungkan kebutuhan bisnis (Need) dengan penawaran (Offer), dilengkapi verifikasi, ranking reputasi, chat, membership, dan alur deal formal.

Visi kami: mempercepat koneksi bisnis yang relevan dan dapat dipercaya di Indonesia.
`,
  },
  {
    slug: 'cara-kerja',
    title: 'Cara Kerja Platform',
    content: `# Cara Kerja Sinaptex

1. **Daftar & lengkapi profil** — akun, party/bisnis, kapabilitas.
2. **Publikasikan Need atau Offer** — kuota non-member terbatas; membership memperluas kuota.
3. **Matching & ranking** — sistem menyarankan kandidat berdasarkan relevansi dan reputasi.
4. **Chat atau Invitation** — komunikasi cepat dari opportunity, atau undangan formal menuju Deal.
5. **Selesaikan & review** — bangun skor reputasi untuk peluang berikutnya.
`,
  },
];

async function main() {
  for (const page of LEGAL_PAGES) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content, status: 'PUBLISHED' },
      create: { ...page, status: 'PUBLISHED' },
    });
    console.log('Published:', page.slug);
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
