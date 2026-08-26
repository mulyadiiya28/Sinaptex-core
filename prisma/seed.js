const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = [
    { type: 'FREE', name: 'Free', priorityWeight: 0, price: 0, durationDays: 3650 },
    { type: 'BASIC', name: 'Basic Boost', priorityWeight: 25, price: 49000, durationDays: 7 },
    { type: 'PREMIUM', name: 'Premium Boost', priorityWeight: 60, price: 149000, durationDays: 14 },
    { type: 'VIP', name: 'VIP Boost', priorityWeight: 100, price: 399000, durationDays: 30 },
  ];

  for (const plan of plans) {
    await prisma.boostPlan.upsert({
      where: { type: plan.type },
      update: plan,
      create: plan,
    });
  }

  const categories = [
    'Manufaktur', 'Teknologi & Software', 'F&B', 'Retail', 'Logistik & Supply Chain',
    'Jasa Konsultasi', 'Pertanian & Agribisnis', 'Konstruksi & Properti', 'Investasi & Modal Ventura',
  ];
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  // ---- Master data (Phase 04) ----
  const indonesia = await prisma.country.upsert({
    where: { code: 'ID' },
    update: {},
    create: { name: 'Indonesia', code: 'ID' },
  });

  const provinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Bali'];
  const provinceRecords = {};
  for (const name of provinces) {
    provinceRecords[name] = await prisma.province.upsert({
      where: { countryId_name: { countryId: indonesia.id, name } },
      update: {},
      create: { name, countryId: indonesia.id },
    });
  }

  const cities = {
    'DKI Jakarta': ['Jakarta Selatan', 'Jakarta Pusat', 'Jakarta Barat'],
    'Jawa Barat': ['Bandung', 'Bekasi', 'Bogor'],
    'Jawa Tengah': ['Semarang', 'Solo'],
    'Jawa Timur': ['Surabaya', 'Malang'],
    Bali: ['Denpasar'],
  };
  for (const [provinceName, cityNames] of Object.entries(cities)) {
    const province = provinceRecords[provinceName];
    for (const cityName of cityNames) {
      await prisma.city.upsert({
        where: { provinceId_name: { provinceId: province.id, name: cityName } },
        update: {},
        create: { name: cityName, provinceId: province.id },
      });
    }
  }

  const currencies = [
    { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
  }

  const languages = [
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'en', name: 'English' },
  ];
  for (const l of languages) {
    await prisma.language.upsert({ where: { code: l.code }, update: l, create: l });
  }

  const baseTags = ['startup', 'umkm', 'ekspor', 'ramah-lingkungan', 'b2b', 'b2c', 'digital', 'manufaktur'];
  for (const name of baseTags) {
    await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  }

  // ---- Business Decision Engine knowledge base (Phase 19) ----
  // Contoh persis dari filosofi platform: orang tidak benar-benar butuh "bor",
  // "rumah", atau "CRM" — mereka butuh hasil akhirnya. Lihat
  // docs/business-decision-philosophy.md untuk penjelasan lengkap.
  //
  // JobToBeDone tidak punya unique constraint di `statement` (teksnya panjang/
  // naratif), jadi dibungkus helper findOrCreateJob ini supaya seed aman
  // dijalankan berkali-kali tanpa duplikasi Job & ClarifyingQuestion.
  async function findOrCreateJob(rootProblemId, statement, questions = []) {
    const existing = await prisma.jobToBeDone.findFirst({ where: { rootProblemId, statement } });
    if (existing) return existing;

    const job = await prisma.jobToBeDone.create({ data: { rootProblemId, statement } });
    if (questions.length) {
      await prisma.clarifyingQuestion.createMany({
        data: questions.map((question, order) => ({ jobId: job.id, question, order })),
      });
    }
    return job;
  }

  // Contoh 1: Bor Listrik -> TIDAK ambigu, cuma 1 Job -> auto-resolve, tanpa klarifikasi.
  const drillProblem = await prisma.rootProblem.upsert({
    where: { name: 'Butuh memasang sesuatu di permukaan keras' },
    update: {},
    create: {
      name: 'Butuh memasang sesuatu di permukaan keras',
      description: 'Orang butuh menempelkan/menggantung barang di dinding, kayu, atau beton.',
    },
  });
  const drillJob = await findOrCreateJob(
    drillProblem.id,
    'Ketika saya perlu memasang sesuatu di dinding/permukaan keras, saya ingin membuat lubang ' +
      'dengan cepat dan presisi, supaya barang itu bisa terpasang kuat.'
  );
  const drillCategory = await prisma.solutionCategory.upsert({
    where: { name: 'Bor Listrik' },
    update: {},
    create: { name: 'Bor Listrik', keywords: ['bor', 'bor listrik', 'drill', 'mata bor'] },
  });
  await prisma.solutionCategoryJob.upsert({
    where: { solutionCategoryId_jobId: { solutionCategoryId: drillCategory.id, jobId: drillJob.id } },
    update: {},
    create: { solutionCategoryId: drillCategory.id, jobId: drillJob.id, relevance: 1 },
  });

  // Contoh 2: Rumah/Properti -> AMBIGU, 3 kemungkinan Job -> perlu klarifikasi.
  const shelterProblem = await prisma.rootProblem.upsert({
    where: { name: 'Kebutuhan tempat tinggal & keamanan finansial' },
    update: {},
    create: { name: 'Kebutuhan tempat tinggal & keamanan finansial' },
  });
  const houseCategory = await prisma.solutionCategory.upsert({
    where: { name: 'Rumah / Properti' },
    update: {},
    create: { name: 'Rumah / Properti', keywords: ['rumah', 'properti', 'hunian', 'apartemen'] },
  });

  const shelterJob = await findOrCreateJob(
    shelterProblem.id,
    'Ketika saya belum punya tempat tinggal tetap, saya ingin unit hunian yang aman dan nyaman, ' +
      'supaya saya dan keluarga punya tempat berteduh.',
    [
      'Apakah Anda saat ini belum punya tempat tinggal tetap?',
      'Apakah properti ini untuk ditinggali sendiri/keluarga, bukan disewakan?',
    ]
  );

  const statusJob = await findOrCreateJob(
    shelterProblem.id,
    'Ketika saya ingin dipandang mapan secara sosial, saya ingin properti di lokasi/segmen tertentu, ' +
      'supaya saya mendapat pengakuan status sosial.',
    [
      'Apakah lokasi/prestise lingkungan jadi pertimbangan utama Anda?',
      'Apakah properti ini penting untuk ditunjukkan/dipamerkan ke orang lain?',
    ]
  );

  const investmentJob = await findOrCreateJob(
    shelterProblem.id,
    'Ketika saya punya kelebihan dana, saya ingin aset yang nilainya naik atau bisa disewakan, ' +
      'supaya uang saya bekerja sebagai investasi.',
    [
      'Apakah Anda berencana menyewakan atau menjual kembali properti ini?',
      'Apakah keputusan ini murni pertimbangan return finansial, bukan untuk ditinggali?',
    ]
  );

  for (const [job, relevance] of [
    [shelterJob, 1],
    [statusJob, 0.8],
    [investmentJob, 0.9],
  ]) {
    await prisma.solutionCategoryJob.upsert({
      where: { solutionCategoryId_jobId: { solutionCategoryId: houseCategory.id, jobId: job.id } },
      update: { relevance },
      create: { solutionCategoryId: houseCategory.id, jobId: job.id, relevance },
    });
  }

  // Contoh 3: CRM Software -> orang cari "CRM" tapi sebenarnya butuh follow-up tidak bocor.
  const crmProblem = await prisma.rootProblem.upsert({
    where: { name: 'Kehilangan penjualan karena follow-up pelanggan tidak konsisten' },
    update: {},
    create: { name: 'Kehilangan penjualan karena follow-up pelanggan tidak konsisten' },
  });
  const crmJob = await findOrCreateJob(
    crmProblem.id,
    'Ketika saya punya banyak calon pelanggan yang harus di-follow up, saya ingin sistem pencatatan ' +
      'dan pengingat otomatis, supaya tidak ada follow-up yang bocor dan penjualan hilang sia-sia.'
  );
  const crmCategory = await prisma.solutionCategory.upsert({
    where: { name: 'CRM Software' },
    update: {},
    create: {
      name: 'CRM Software',
      keywords: ['crm', 'customer relationship management', 'pelanggan', 'sales pipeline', 'follow up'],
    },
  });
  await prisma.solutionCategoryJob.upsert({
    where: { solutionCategoryId_jobId: { solutionCategoryId: crmCategory.id, jobId: crmJob.id } },
    update: {},
    create: { solutionCategoryId: crmCategory.id, jobId: crmJob.id, relevance: 1 },
  });

  // ---- Business Diagnosis Engine knowledge base (Phase 20) ----
  // Contoh persis dari ilustrasi: "penjualan menurun" punya DUA kemungkinan akar
  // masalah yang butuh BENTUK REKOMENDASI BERBEDA — satu butuh solusi marketplace
  // (pelatihan), satu lagi cukup saran murni (tanpa produk apa pun).

  const salesSymptom = await prisma.businessSymptom.upsert({
    where: { name: 'Penjualan Menurun' },
    update: {},
    create: {
      name: 'Penjualan Menurun',
      description: 'Volume atau nilai transaksi yang berhasil closing menurun dibanding periode sebelumnya.',
    },
  });

  const conversionFactor = await prisma.diagnosticFactor.create({
    data: {
      symptomId: salesSymptom.id,
      name: 'Conversion Rate 30 Hari Terakhir',
      dataType: 'PERCENTAGE',
      sourceType: 'AUTO_PLATFORM',
      autoSourceKey: 'party_conversion_rate',
      unit: '%',
      order: 0,
    },
  });
  const sentimentFactor = await prisma.diagnosticFactor.create({
    data: {
      symptomId: salesSymptom.id,
      name: 'Skor Sentimen Review 90 Hari Terakhir',
      dataType: 'PERCENTAGE',
      sourceType: 'AUTO_PLATFORM',
      autoSourceKey: 'party_avg_review_sentiment',
      unit: 'skor 0-100',
      order: 1,
    },
  });
  const trainingFactor = await prisma.diagnosticFactor.create({
    data: {
      symptomId: salesSymptom.id,
      // Platform tidak melacak riwayat training staff secara native -> MANUAL_INPUT
      name: 'Staff Penjualan Pernah Ikut Pelatihan Closing?',
      dataType: 'BOOLEAN',
      sourceType: 'MANUAL_INPUT',
      order: 2,
    },
  });

  // Root Cause A: skill gap -> MATCH_OPPORTUNITY (butuh Job + SolutionCategory baru)
  const salesSkillProblem = await prisma.rootProblem.upsert({
    where: { name: 'Kehilangan penjualan karena keterampilan closing rendah' },
    update: {},
    create: { name: 'Kehilangan penjualan karena keterampilan closing rendah' },
  });
  const salesTrainingJob = await findOrCreateJob(
    salesSkillProblem.id,
    'Ketika staff penjualan kesulitan closing deal, saya ingin mereka dilatih teknik penjualan yang efektif, ' +
      'supaya conversion rate meningkat.'
  );
  const salesTrainingCategory = await prisma.solutionCategory.upsert({
    where: { name: 'Pelatihan Penjualan Karyawan' },
    update: {},
    create: {
      name: 'Pelatihan Penjualan Karyawan',
      keywords: ['pelatihan penjualan', 'sales training', 'training karyawan', 'coaching sales'],
    },
  });
  await prisma.solutionCategoryJob.upsert({
    where: {
      solutionCategoryId_jobId: { solutionCategoryId: salesTrainingCategory.id, jobId: salesTrainingJob.id },
    },
    update: {},
    create: { solutionCategoryId: salesTrainingCategory.id, jobId: salesTrainingJob.id, relevance: 1 },
  });

  const skillGapRootCause = await prisma.businessRootCause.create({
    data: {
      symptomId: salesSymptom.id,
      name: 'Keterampilan Closing Sales Rendah',
      explanation:
        'Conversion rate di bawah 15% DAN staff belum pernah ikut pelatihan penjualan — indikasi kuat ' +
        'bahwa masalahnya ada di skill closing tim sales, bukan di produk, harga, atau reputasi.',
    },
  });
  await prisma.businessDecision.create({
    data: {
      rootCauseId: skillGapRootCause.id,
      recommendationType: 'MATCH_OPPORTUNITY',
      jobId: salesTrainingJob.id,
    },
  });
  await prisma.diagnosticRule.create({
    data: {
      symptomId: salesSymptom.id,
      rootCauseId: skillGapRootCause.id,
      priority: 0,
      conditions: [
        { factorId: conversionFactor.id, operator: 'LT', value: 15 },
        { factorId: trainingFactor.id, operator: 'IS_FALSE' },
      ],
    },
  });

  // Root Cause B: sentimen negatif -> ADVISORY_ONLY (TIDAK dipaksa match produk apa pun)
  const negativeSentimentRootCause = await prisma.businessRootCause.create({
    data: {
      symptomId: salesSymptom.id,
      name: 'Sentimen Pelanggan Negatif',
      explanation:
        'Skor sentimen review di bawah 60/100 — pelanggan yang sudah closing pun memberi review buruk. ' +
        'Ini indikasi masalah pengalaman pelanggan pasca-transaksi, bukan kemampuan closing atau produk.',
    },
  });
  const negativeSentimentDecision = await prisma.businessDecision.create({
    data: {
      rootCauseId: negativeSentimentRootCause.id,
      recommendationType: 'ADVISORY_ONLY',
    },
  });
  await prisma.diagnosticRule.create({
    data: {
      symptomId: salesSymptom.id,
      rootCauseId: negativeSentimentRootCause.id,
      priority: 1,
      conditions: [{ factorId: sentimentFactor.id, operator: 'LT', value: 60 }],
    },
  });
  // Advisory di-seed langsung berstatus PUBLISHED (mewakili "pustaka saran yang sudah
  // disetujui sejak awal"). Lewat API, entri baru SELALU mulai dari DRAFT dan wajib
  // lewat PATCH /business-diagnosis/advisory/:id/publish sebelum tampil ke user.
  await prisma.advisoryContent.create({
    data: {
      decisionId: negativeSentimentDecision.id,
      title: 'Tanggapi Review Negatif Secara Cepat & Spesifik',
      body:
        'Balas setiap review negatif dalam 24 jam dengan permintaan maaf yang tulus dan langkah konkret ' +
        'perbaikan — bukan template generik. Identifikasi 2-3 tema keluhan yang paling sering muncul ' +
        '(mis. keterlambatan pengiriman, respons lambat, kualitas tidak sesuai deskripsi) dan perbaiki ' +
        'akar penyebabnya, bukan hanya membalas reviewnya. Follow up secara personal ke pelanggan yang ' +
        'kecewa untuk menawarkan solusi, dan minta mereka memperbarui review setelah masalah selesai.',
      authorType: 'ADMIN',
      status: 'PUBLISHED',
      reviewedAt: new Date(),
    },
  });

  // ---- Membership (MVP Phase 4) — Plan tanpa harga, Pricing terpisah (histori) ----
  const membershipPlans = [
    { name: 'Silver', durationDays: 30, features: ['Publish Offer', 'Chat dengan Buyer'] },
    { name: 'Gold', durationDays: 30, features: ['Semua fitur Silver', 'Prioritas pencarian', 'Badge Verified'] },
    {
      name: 'Enterprise',
      durationDays: 30,
      features: ['Semua fitur Gold', 'Dedicated support', 'Laporan analitik bulanan'],
    },
  ];
  const planPrices = { Silver: 49000, Gold: 100000, Enterprise: 299000 };

  for (const planData of membershipPlans) {
    const plan = await prisma.membershipPlan.upsert({
      where: { name: planData.name },
      update: { durationDays: planData.durationDays, features: planData.features },
      create: planData,
    });

    const existingActivePrice = await prisma.membershipPricing.findFirst({
      where: { planId: plan.id, status: 'ACTIVE' },
    });
    if (!existingActivePrice) {
      await prisma.membershipPricing.create({
        data: { planId: plan.id, price: planPrices[planData.name], currency: 'IDR', status: 'ACTIVE' },
      });
    }
  }

  // ---- Content/CMS (MVP Phase 1) — DRAFT, wajib publish manual oleh admin ----
  const staticPages = [
    {
      slug: 'tentang-kami',
      title: 'Tentang Kami',
      content:
        '# Tentang Kami\n\n**TODO admin**: isi cerita platform ini — masalah yang diselesaikan, ' +
        'visi, dan tim di baliknya. Lihat docs/vision.md untuk draft awal.',
    },
    {
      slug: 'cara-kerja',
      title: 'Cara Kerja',
      content:
        '# Cara Kerja\n\n1. Buat profil\n2. Publikasikan Need (gratis) atau Offer (butuh membership aktif)\n' +
        '3. Cari lawan yang cocok lewat Matching Engine\n4. Chat, negosiasi, deal\n5. Selesaikan project & beri review\n\n' +
        '**TODO admin**: lengkapi dengan screenshot/ilustrasi di sisi frontend.',
    },
    {
      slug: 'syarat-ketentuan',
      title: 'Syarat & Ketentuan',
      content: '# Syarat & Ketentuan\n\n**TODO admin/legal**: draft final syarat & ketentuan sebelum go-live.',
    },
    {
      slug: 'kebijakan-privasi',
      title: 'Kebijakan Privasi',
      content:
        '# Kebijakan Privasi\n\n**TODO admin/legal**: draft final kebijakan privasi (rujuk UU PDP) ' +
        'sebelum go-live — lihat catatan retensi data di docs/non-functional-requirement.md.',
    },
    {
      slug: 'kontak',
      title: 'Kontak',
      content: '# Kontak\n\n**TODO admin**: isi email/nomor kontak resmi platform.',
    },
  ];
  for (const pageData of staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: pageData.slug },
      update: {},
      create: { ...pageData, status: 'DRAFT' },
    });
  }

  const faqItems = [
    {
      question: 'Apakah membuat akun dan mempublikasikan Need berbayar?',
      answer: 'Tidak. Membuat akun dan mempublikasikan Need selalu gratis. Hanya Offer yang butuh membership aktif.',
      order: 0,
    },
    {
      question: 'Bagaimana cara mengaktifkan membership?',
      answer:
        'Pilih paket di halaman Membership, lanjutkan ke pembayaran (QRIS/VA/e-wallet lewat Midtrans), ' +
        'membership otomatis aktif begitu pembayaran dikonfirmasi.',
      order: 1,
    },
    {
      question: 'Apakah chat saya hilang kalau membership berakhir?',
      answer: 'Tidak. Percakapan yang sudah ada tetap bisa diakses meski membership sudah berakhir — hanya memulai percakapan BARU ke penyedia jasa yang butuh membership aktif.',
      order: 2,
    },
  ];
  for (const faq of faqItems) {
    const existing = await prisma.faqItem.findFirst({ where: { question: faq.question } });
    if (!existing) {
      await prisma.faqItem.create({ data: { ...faq, status: 'DRAFT' } });
    }
  }

  console.log('✅ Seed complete: boost plans, categories, master data, & Business Decision Engine knowledge base');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
