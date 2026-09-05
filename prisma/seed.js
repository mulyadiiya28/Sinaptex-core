/**
 * Prisma seed — Sinaptex MVP
 *
 * Idempotent upserts:
 *   1. Boost plans
 *   2. Categories
 *   3. Capabilities & tags
 *   4. Geo / currency / language
 *   5. Membership plans + active pricing
 *   6. Business decision / diagnosis knowledge base
 *   7. CMS legal pages (PUBLISHED) + FAQs
 *   8. Dev/staging test users (optional sample data)
 *
 * Run:
 *   npx prisma db seed
 *   node prisma/seed.js
 */

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreateJob(rootProblemId, statement, questions = []) {
  const existing = await prisma.jobToBeDone.findFirst({
    where: { rootProblemId, statement },
  });
  if (existing) return existing;

  const job = await prisma.jobToBeDone.create({
    data: { rootProblemId, statement },
  });

  if (questions.length > 0) {
    await prisma.clarifyingQuestion.createMany({
      data: questions.map((question, order) => ({
        jobId: job.id,
        question,
        order,
      })),
    });
  }

  return job;
}

async function upsertStaticPage({ slug, title, content }) {
  return prisma.staticPage.upsert({
    where: { slug },
    update: { title, content, status: 'PUBLISHED' },
    create: { slug, title, content, status: 'PUBLISHED' },
  });
}

async function upsertFaq({ question, answer, order }) {
  const existing = await prisma.faqItem.findFirst({ where: { question } });
  if (!existing) {
    return prisma.faqItem.create({
      data: { question, answer, order, status: 'PUBLISHED' },
    });
  }
  return prisma.faqItem.update({
    where: { id: existing.id },
    data: { answer, order, status: 'PUBLISHED' },
  });
}

// ---------------------------------------------------------------------------
// Seed sections
// ---------------------------------------------------------------------------

async function seedBoostPlans() {
  const plans = [
    { type: 'FREE', name: 'Free', priorityWeight: 0, price: 0, durationDays: 3650 },
    { type: 'BASIC', name: 'Basic Boost', priorityWeight: 25, price: 49000, durationDays: 7 },
    { type: 'PREMIUM', name: 'Premium Boost', priorityWeight: 60, price: 149000, durationDays: 14 },
    { type: 'VIP', name: 'VIP Boost', priorityWeight: 100, price: 399000, durationDays: 30 },
  ];

  for (let i = 0; i < plans.length; i++) {
    let item = plans[i];

    await prisma.boostPlan.upsert({
      where: { type: item.type },
      update: item,
      create: item,
    });
  }
  console.log('  ✓ Boost plans seeded');
}

async function seedCategories() {
  const defaultCategories = [
    {
      name: 'Manufaktur & Fabrikasi',
      children: ['Mesin & Perkakas Industri', 'Kemasan & Packaging', 'Tekstil & Garment', 'Kimia & Plastik'],
    },
    {
      name: 'Teknologi & Software',
      children: ['Pengembangan Web & Aplikasi', 'IT Infrastructure & Cloud', 'AI & Data Analytics', 'Cybersecurity'],
    },
    {
      name: 'Makanan & Minuman (F&B)',
      children: ['Bahan Baku F&B', 'Peralatan Restoran & Kafe', 'Katering & Distribusi F&B'],
    },
    {
      name: 'Logistik & Supply Chain',
      children: ['Freight Forwarding & Ekspedisi', 'Gudang & Fulfillment', 'Armada Truk & Transportasi'],
    },
    {
      name: 'Jasa Profesional & Konsultasi',
      children: ['Legal & Notaris', 'Akuntansi & Perpajakan', 'Audit & Sertifikasi ISO', 'Konsultan Manajemen'],
    },
    {
      name: 'Pertanian, Peternakan & Perikanan',
      children: ['Komoditas Pangan & Hasil Bumi', 'Pupuk & Pakan Ternak', 'Agro-Teknologi'],
    },
    {
      name: 'Konstruksi & Properti',
      children: ['Material Bangunan', 'Kontraktor & Desain Bangunan', 'Sewa Ruang Usaha / Gudang'],
    },
    {
      name: 'Investasi, Modal & Finansial',
      children: ['Modal Kerja B2B', 'Venture Capital & Ekuitas', 'Invoice Financing'],
    },
    {
      name: 'Retail & Grosir',
      children: ['Distributor Grosir', 'Perlengkapan Toko / POS', 'Konsinyasi Retail'],
    },
  ];

  for (let item of defaultCategories) {
    const parent = await prisma.category.upsert({
      where: { name: item.name },
      update: {},
      create: { name: item.name },
    });

    for (let childName of item.children || []) {
      await prisma.category.upsert({
        where: { name: childName },
        update: { parentId: parent.id },
        create: { name: childName, parentId: parent.id },
      });
    }
  }
  console.log('  ✓ Default system categories seeded');
}

async function seedCapabilitiesAndTags() {
  const standardCapabilities = [
    'ISO 9001 Certified',
    'Halal Certified',
    'BPOM Registered',
    'Custom OEM/ODM Manufacturing',
    'Ekspor / Import Ready',
    'SLA Garansi 24/7',
    'Kapasitas Produksi Massal (>10.000 unit/bln)',
    'Lab Uji & QC Terstandarisasi',
    'Pengiriman Seluruh Indonesia',
    'Penyimpanan Suhu Dingin (Cold Storage)',
    'Payment Gateway Integration',
    'White-label Service',
  ];
  for (let i = 0; i < standardCapabilities.length; i++) {
    let item = standardCapabilities[i];

    await prisma.capability.upsert({
      where: { name: item },
      update: {},
      create: { name: item },
    });
  }

  const baseTags = [
    'startup',
    'umkm',
    'ekspor',
    'ramah-lingkungan',
    'b2b',
    'b2c',
    'digital',
    'manufaktur',
    'oem',
    'fast-moving',
    'qris',
    'halal',
    'iso-certified',
    'high-volume',
  ];

  for (let item of baseTags) {
    await prisma.tag.upsert({
      where: { name: item },
      update: {},
      create: { name: item },
    });
  }
  console.log('  ✓ Capabilities and tags master data seeded');
}

async function seedGeoCurrencyLanguage() {
  const indonesia = await prisma.country.upsert({
    where: { code: 'ID' },
    update: {},
    create: { name: 'Indonesia', code: 'ID' },
  });

  const provinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'Bali'];
  const provinceRecords = {};

  for (let i = 0; i < provinces.length; i++) {
    let item = provinces[i];

    provinceRecords[item] = await prisma.province.upsert({
      where: { countryId_name: { countryId: indonesia.id, name: item } },
      update: {},
      create: { name: item, countryId: indonesia.id },
    });
  }

  const cities = {
    'DKI Jakarta': ['Jakarta Selatan', 'Jakarta Pusat', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara'],
    'Jawa Barat': ['Bandung', 'Bekasi', 'Bogor', 'Depok', 'Cikarang', 'Karawang'],
    'Jawa Tengah': ['Semarang', 'Solo', 'Yogyakarta', 'Kudus'],
    'Jawa Timur': ['Surabaya', 'Malang', 'Sidoarjo', 'Gresik'],
    Banten: ['Tangerang', 'Tangerang Selatan', 'Cilegon', 'Serang'],
    Bali: ['Denpasar', 'Badung', 'Gianyar'],
  };

  let entries = Object.entries(cities);

  for (let i = 0; i < entries.length; i++) {
    let item = entries[i];
    let provinceName = item[0];
    let cityNames = item[1];
    const province = provinceRecords[provinceName];

    for (let j = 0; j < cityNames.length; j++) {
      let cityName = cityNames[j];

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
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  ];
  for (let i = 0; i < currencies.length; i++) {
    let item = currencies[i];

    await prisma.currency.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  const languages = [
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'en', name: 'English' },
  ];
  for (let i = 0; i < languages.length; i++) {
    let item = languages[i];

    await prisma.language.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }
  console.log('  ✓ Geographic, currency, and language master data seeded');
}

async function seedMembership() {
  const membershipPlans = [
    {
      name: 'Free Non-Member',
      durationDays: 3650,
      features: [
        'Posting 1 Aktif Need & 1 Aktif Offer',
        'Direct Chat via Need/Offer',
        'Akses Standar Matching Engine',
      ],
      price: 0,
    },
    {
      name: 'Silver',
      durationDays: 30,
      features: [
        'Posting hingga 20 Aktif Need & 20 Aktif Offer',
        'Direct Profile Chat tanpa batas',
        'Badge verified membership',
        'Filter prioritas rekomendasi',
      ],
      price: 49000,
    },
    {
      name: 'Gold',
      durationDays: 30,
      features: [
        'Semua fitur Silver',
        'Prioritas tinggi pada Matching & Ranking Engine',
        'Akses Business Decision & Diagnostic Advisor',
        'Dukungan Escrow Transaksi Terproteksi',
        'Laporan analisis sentimen pasar',
      ],
      price: 100000,
    },
    {
      name: 'Enterprise',
      durationDays: 30,
      features: [
        'Semua fitur Gold',
        'Dedicated Key Account Manager',
        'Multi-role party management & Legal validation expedited',
        'Custom export analitik bulanan',
        'Akses API webhook & integrasi ERP',
      ],
      price: 299000,
    },
  ];

  for (let i = 0; i < membershipPlans.length; i++) {
    let item = membershipPlans[i];

    const plan = await prisma.membershipPlan.upsert({
      where: { name: item.name },
      update: {
        durationDays: item.durationDays,
        features: item.features,
      },
      create: {
        name: item.name,
        durationDays: item.durationDays,
        features: item.features,
      },
    });

    const existingActivePrice = await prisma.membershipPricing.findFirst({
      where: { planId: plan.id, status: 'ACTIVE' },
    });

    if (!existingActivePrice) {
      await prisma.membershipPricing.create({
        data: {
          planId: plan.id,
          price: item.price,
          currency: 'IDR',
          status: 'ACTIVE',
        },
      });
    }
  }

  const planCount = await prisma.membershipPlan.count();
  const activePricing = await prisma.membershipPricing.count({
    where: { status: 'ACTIVE' },
  });
  console.log('  ✓ Membership tiers and active pricing rules seeded');
  console.log('  → membershipPlan=' + planCount + ', activePricing=' + activePricing);
}

async function seedDiagnosisKnowledgeBase() {
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
    create: {
      name: 'Bor Listrik',
      keywords: ['bor', 'bor listrik', 'drill', 'mata bor'],
    },
  });

  await prisma.solutionCategoryJob.upsert({
    where: {
      solutionCategoryId_jobId: {
        solutionCategoryId: drillCategory.id,
        jobId: drillJob.id,
      },
    },
    update: {},
    create: {
      solutionCategoryId: drillCategory.id,
      jobId: drillJob.id,
      relevance: 1,
    },
  });

  const shelterProblem = await prisma.rootProblem.upsert({
    where: { name: 'Kebutuhan tempat tinggal & keamanan finansial' },
    update: {},
    create: { name: 'Kebutuhan tempat tinggal & keamanan finansial' },
  });

  const houseCategory = await prisma.solutionCategory.upsert({
    where: { name: 'Rumah / Properti' },
    update: {},
    create: {
      name: 'Rumah / Properti',
      keywords: ['rumah', 'properti', 'hunian', 'apartemen'],
    },
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

  const jobMappings = [
    [shelterJob, 1],
    [statusJob, 0.8],
    [investmentJob, 0.9],
  ];

  for (let i = 0; i < jobMappings.length; i++) {
    let item = jobMappings[i];
    let [job, relevance] = item;

    await prisma.solutionCategoryJob.upsert({
      where: {
        solutionCategoryId_jobId: {
          solutionCategoryId: houseCategory.id,
          jobId: job.id,
        },
      },
      update: { relevance },
      create: {
        solutionCategoryId: houseCategory.id,
        jobId: job.id,
        relevance,
      },
    });
  }

  const crmProblem = await prisma.rootProblem.upsert({
    where: { name: 'Kehilangan penjualan karena follow-up pelanggan tidak konsisten' },
    update: {},
    create: {
      name: 'Kehilangan penjualan karena follow-up pelanggan tidak konsisten',
    },
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
    where: {
      solutionCategoryId_jobId: {
        solutionCategoryId: crmCategory.id,
        jobId: crmJob.id,
      },
    },
    update: {},
    create: {
      solutionCategoryId: crmCategory.id,
      jobId: crmJob.id,
      relevance: 1,
    },
  });

  const salesSymptom = await prisma.businessSymptom.upsert({
    where: { name: 'Penjualan Menurun' },
    update: {},
    create: {
      name: 'Penjualan Menurun',
      description:
        'Volume atau nilai transaksi yang berhasil closing menurun dibanding periode sebelumnya.',
    },
  });

  let conversionFactor = await prisma.diagnosticFactor.findFirst({
    where: { symptomId: salesSymptom.id, name: 'Conversion Rate 30 Hari Terakhir' },
  });
  if (!conversionFactor) {
    conversionFactor = await prisma.diagnosticFactor.create({
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
  }

  let sentimentFactor = await prisma.diagnosticFactor.findFirst({
    where: { symptomId: salesSymptom.id, name: 'Skor Sentimen Review 90 Hari Terakhir' },
  });
  if (!sentimentFactor) {
    sentimentFactor = await prisma.diagnosticFactor.create({
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
  }

  let trainingFactor = await prisma.diagnosticFactor.findFirst({
    where: {
      symptomId: salesSymptom.id,
      name: 'Staff Penjualan Pernah Ikut Pelatihan Closing?',
    },
  });
  if (!trainingFactor) {
    trainingFactor = await prisma.diagnosticFactor.create({
      data: {
        symptomId: salesSymptom.id,
        name: 'Staff Penjualan Pernah Ikut Pelatihan Closing?',
        dataType: 'BOOLEAN',
        sourceType: 'MANUAL_INPUT',
        order: 2,
      },
    });
  }

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
      solutionCategoryId_jobId: {
        solutionCategoryId: salesTrainingCategory.id,
        jobId: salesTrainingJob.id,
      },
    },
    update: {},
    create: {
      solutionCategoryId: salesTrainingCategory.id,
      jobId: salesTrainingJob.id,
      relevance: 1,
    },
  });

  let skillGapRootCause = await prisma.businessRootCause.findFirst({
    where: { symptomId: salesSymptom.id, name: 'Keterampilan Closing Sales Rendah' },
  });
  if (!skillGapRootCause) {
    skillGapRootCause = await prisma.businessRootCause.create({
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
  }

  let negativeSentimentRootCause = await prisma.businessRootCause.findFirst({
    where: { symptomId: salesSymptom.id, name: 'Sentimen Pelanggan Negatif' },
  });
  if (!negativeSentimentRootCause) {
    negativeSentimentRootCause = await prisma.businessRootCause.create({
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

    await prisma.advisoryContent.create({
      data: {
        decisionId: negativeSentimentDecision.id,
        title: 'Tanggapi Review Negatif Secara Cepat & Spesifik',
        body:
          'Balas setiap review negatif dalam 24 jam dengan permintaan maaf yang tulus dan langkah konkret ' +
          'perbaikan — bukan template generik. Identifikasi 2-3 tema keluhan yang paling sering muncul ' +
          '(mis. keterlambatan pengiriman, respons lambat, kualitas tidak sesuai deskripsi) dan perbaiki ' +
          'akar penyebabnya, bukan hanya membalas reviewnya.',
        authorType: 'ADMIN',
        status: 'PUBLISHED',
        reviewedAt: new Date(),
      },
    });
  }

  console.log('  ✓ Business Decision & Diagnosis knowledge base seeded');
}

async function seedCmsLegalAndFaq() {
  const staticPages = [
    {
      slug: 'tentang-kami',
      title: 'Tentang Kami',
      content:
        '# Tentang Sinaptex\n\n' +
        'Sinaptex adalah platform B2B matchmaking & partnership intelligence yang menghubungkan ' +
        'pembeli (Buyer), penyedia (Supplier), dan investor melalui rekomendasi berbasis ' +
        'Job-To-Be-Done, verifikasi legalitas, dan skor reputasi.\n\n' +
        'Misi kami: mempercepat kemitraan bisnis yang transparan, terukur, dan aman.',
    },
    {
      slug: 'cara-kerja',
      title: 'Cara Kerja Platform',
      content:
        '# Cara Kerja Sinaptex\n\n' +
        '1. Daftarkan akun profil & party (perusahaan/individu).\n' +
        '2. Publikasikan kebutuhan (Need) atau penawaran (Offer).\n' +
        '3. Matching engine menilai kategori, budget, dan status verifikasi.\n' +
        '4. Komunikasi via chat; transaksi berisiko dapat memakai Escrow.\n' +
        '5. Selesaikan kolaborasi, beri review, dan bangun reputasi.\n\n' +
        'Membership berbayar menambah kuota posting, prioritas ranking, dan fitur lanjutan.',
    },
    {
      slug: 'syarat-ketentuan',
      title: 'Syarat & Ketentuan',
      content:
        '# Syarat & Ketentuan Layanan Sinaptex\n\n' +
        'Terakhir diperbarui: September 2026.\n\n' +
        '## 1. Penerimaan\n' +
        'Dengan membuat akun atau menggunakan platform Sinaptex, Anda menyetujui syarat ini. ' +
        'Jika tidak setuju, hentikan penggunaan layanan.\n\n' +
        '## 2. Akun & verifikasi\n' +
        '1. Anda wajib memberikan data yang akurat.\n' +
        '2. Verifikasi dokumen (KTP, NIB, NPWP, dll.) dapat diminta untuk fitur tertentu.\n' +
        '3. Kami dapat menangguhkan akun yang melanggar hukum atau ketentuan platform.\n\n' +
        '## 3. Konten & interaksi B2B\n' +
        '1. Need/Offer dan komunikasi harus terkait aktivitas bisnis yang sah.\n' +
        '2. Dilarang penipuan, spam, peniruan identitas, atau konten ilegal.\n' +
        '3. Anda bertanggung jawab atas konten yang Anda publikasikan.\n\n' +
        '## 4. Escrow & transaksi\n' +
        '1. Fitur escrow menahan dana sesuai status transaksi yang disepakati para pihak.\n' +
        '2. Pelepasan/pengembalian dana mengikuti konfirmasi pihak terkait atau keputusan mediasi internal.\n' +
        '3. Sinaptex bukan bank; penyediaan escrow tunduk pada mitra pembayaran dan hukum yang berlaku.\n\n' +
        '## 5. Membership & pembayaran\n' +
        '1. Harga paket mengikuti daftar di Platform pada saat checkout.\n' +
        '2. Aktivasi membership berbayar dilakukan setelah konfirmasi dari payment gateway (mis. Midtrans).\n' +
        '3. Kecuali diwajibkan hukum yang berlaku, biaya membership yang sudah aktif umumnya ' +
        'tidak dapat diganti rugi secara proporsional — kebijakan dapat diperbarui oleh admin.\n\n' +
        '## 6. Batasan tanggung jawab\n' +
        'Platform disediakan apa adanya. Kami tidak menjamin hasil bisnis tertentu dari matching ' +
        'atau rekomendasi. Sengketa komersial antar pengguna diselesaikan terlebih dahulu antar pihak.\n\n' +
        '## 7. Perubahan ketentuan\n' +
        'Kami dapat memperbarui syarat ini. Penggunaan berkelanjutan setelah perubahan dianggap sebagai penerimaan.\n\n' +
        '## 8. Kontak\n' +
        'Pertanyaan terkait syarat ini: lihat halaman Kontak atau email operasional yang tertera di platform.',
    },
    {
      slug: 'kebijakan-privasi',
      title: 'Kebijakan Privasi',
      content:
        '# Kebijakan Privasi Sinaptex\n\n' +
        'Terakhir diperbarui: September 2026.\n\n' +
        '## 1. Data yang kami kumpulkan\n' +
        '1. Data akun: email, nama, nomor telepon, identitas Supabase.\n' +
        '2. Data profil & party: bio, lokasi, NPWP/NIB (jika diisi), dokumen verifikasi.\n' +
        '3. Data penggunaan: log aktivitas, preferensi, konten Need/Offer/chat seperlunya untuk operasional.\n' +
        '4. Data pembayaran: status transaksi dari payment gateway (kami tidak menyimpan full card data).\n\n' +
        '## 2. Tujuan pemrosesan\n' +
        'Menyediakan layanan matchmaking, keamanan akun, pencegahan fraud, dukungan pelanggan, ' +
        'penagihan membership, dan peningkatan produk.\n\n' +
        '## 3. Dasar & retensi\n' +
        'Pemrosesan didasarkan pada pelaksanaan kontrak, kepentingan sah operasional, dan kewajiban hukum. ' +
        'Data disimpan selama akun aktif dan selama diperlukan untuk kepatuhan atau penyelesaian sengketa.\n\n' +
        '## 4. Berbagi data\n' +
        'Data dapat diproses oleh infrastruktur (hosting, database, email, payment gateway, storage file) ' +
        'di bawah perjanjian yang sesuai. Kami tidak menjual data pribadi Anda.\n\n' +
        '## 5. Keamanan\n' +
        'Kami menerapkan kontrol akses, enkripsi transport, dan praktik operasional wajar. ' +
        'Tidak ada sistem yang 100% bebas risiko.\n\n' +
        '## 6. Hak pengguna\n' +
        'Sesuai UU PDP dan peraturan terkait, Anda dapat meminta akses, koreksi, atau penghapusan ' +
        'data tertentu melalui saluran kontak resmi, dengan peninjauan identitas dan batasan hukum.\n\n' +
        '## 7. Kontak privasi\n' +
        'Untuk permintaan terkait data pribadi, gunakan halaman Kontak atau kanal dukungan resmi Sinaptex.',
    },
    {
      slug: 'kontak',
      title: 'Kontak',
      content:
        '# Kontak Sinaptex\n\n' +
        'Untuk dukungan teknis, kemitraan, atau pertanyaan legal/privasi:\n\n' +
        '- Platform: gunakan formulir/bantuan di aplikasi (jika tersedia)\n' +
        '- Operasional: melalui email yang dipublikasikan di channel resmi Sinaptex\n\n' +
        'Kami berupaya merespons dalam waktu kerja yang wajar.',
    },
  ];

  for (let i = 0; i < staticPages.length; i++) {
    let item = staticPages[i];
    await upsertStaticPage(item);
  }

  const faqItems = [
    {
      question: 'Apakah membuat akun dan mempublikasikan Need berbayar?',
      answer:
        'Tidak. Membuat akun dan mempublikasikan Need selalu gratis. Kuota non-member menyediakan akses dasar ' +
        'dan dapat ditingkatkan kapan saja ke paket membership berbayar.',
      order: 0,
    },
    {
      question: 'Bagaimana cara mengaktifkan membership berbayar?',
      answer:
        'Pilih paket Silver, Gold, atau Enterprise di halaman Membership, lalu selesaikan pembayaran lewat ' +
        'gateway resmi (Midtrans QRIS / Virtual Account / Bank Transfer). Membership akan otomatis aktif.',
      order: 1,
    },
    {
      question: 'Bagaimana keamanan transaksi antar perusahaan di Sinaptex?',
      answer:
        'Sinaptex menyediakan sistem Escrow Transaction terproteksi dan verifikasi legalitas (NPWP, NIB, KTP) ' +
        'sehingga dana ditahan aman hingga kedua pihak mengonfirmasi penyelesaian pekerjaan.',
      order: 2,
    },
    {
      question: 'Di mana syarat ketentuan dan kebijakan privasi?',
      answer:
        'Tersedia di halaman CMS: /syarat-ketentuan dan /kebijakan-privasi (status PUBLISHED).',
      order: 3,
    },
  ];

  for (let i = 0; i < faqItems.length; i++) {
    let item = faqItems[i];
    await upsertFaq(item);
  }

  const publishedPages = await prisma.staticPage.count({
    where: { status: 'PUBLISHED' },
  });
  console.log('  ✓ Static CMS pages (legal PUBLISHED) and FAQs seeded');
  console.log('  → publishedStaticPages=' + publishedPages);
}

async function seedTestUsers() {
  console.log('  → Seeding development / staging test accounts...');

  const techCategory = await prisma.category.findUnique({
    where: { name: 'Pengembangan Web & Aplikasi' },
  });
  const mfgCategory = await prisma.category.findUnique({
    where: { name: 'Mesin & Perkakas Industri' },
  });

  const testUserConfigs = [
    {
      supabaseId: 'dev-admin-uuid-0000-000000000001',
      email: 'admin@sinaptex.internal',
      phone: '+628110000001',
      fullName: 'System Administrator',
      bio: 'Sinaptex Master Platform Administrator & DevOps Lead',
      location: 'Jakarta Selatan',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      reputationScore: 100,
      trustScore: 100,
      roles: ['ADMIN'],
      party: {
        name: 'Sinaptex Central Operations',
        isCompany: true,
        categoryId: techCategory ? techCategory.id : null,
        description: 'Internal operations, security audit & compliance administration unit',
        location: 'Jakarta Selatan',
        npwp: '01.234.567.8-011.000',
        nib: '9120001112223',
        verificationStatus: 'VERIFIED',
      },
      membership: { status: 'ACTIVE', planName: 'Enterprise' },
    },
    {
      supabaseId: 'dev-buyer-uuid-0000-000000000002',
      email: 'buyer.corp@sinaptex.test',
      phone: '+628120000002',
      fullName: 'Budi Santoso',
      bio: 'Procurement Director PT Solusi Manufaktur Prima',
      location: 'Cikarang, Jawa Barat',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      reputationScore: 92,
      trustScore: 95,
      roles: ['BUYER'],
      party: {
        name: 'PT Solusi Manufaktur Prima',
        isCompany: true,
        categoryId: mfgCategory ? mfgCategory.id : null,
        description: 'Perusahaan manufaktur komponen presisi dan perakitan industri otomotif',
        location: 'Kawasan Industri GIIC Cikarang',
        npwp: '02.345.678.9-022.000',
        nib: '9120002223334',
        verificationStatus: 'VERIFIED',
      },
      membership: { status: 'ACTIVE', planName: 'Gold' },
      opportunity: {
        type: 'NEED',
        title: 'Pengadaan 10 Unit CNC Milling 5-Axis Presisi Tinggi',
        description:
          'Dibutuhkan suplier mesin CNC 5-Axis baru/refurbished grade A dengan garansi purna jual 2 tahun ' +
          'dan instalasi langsung di pabrik Cikarang.',
        budgetMin: 500000000,
        budgetMax: 1500000000,
        priority: 'HIGH',
        visibility: 'PUBLIC',
        tags: ['manufaktur', 'oem', 'high-volume'],
      },
    },
    {
      supabaseId: 'dev-supplier-uuid-0000-0000000003',
      email: 'supplier.tech@sinaptex.test',
      phone: '+628130000003',
      fullName: 'Dewi Lestari',
      bio: 'Managing Director PT Indo Tech Machinery',
      location: 'Surabaya, Jawa Timur',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      reputationScore: 96,
      trustScore: 98,
      roles: ['SUPPLIER'],
      party: {
        name: 'PT Indo Tech Machinery',
        isCompany: true,
        categoryId: mfgCategory ? mfgCategory.id : null,
        description: 'Distributor resmi dan perakitan mesin perkakas industri bergaransi resmi',
        location: 'Surabaya Industrial Estate Rungkut (SIER)',
        npwp: '03.456.789.0-033.000',
        nib: '9120003334445',
        verificationStatus: 'VERIFIED',
      },
      membership: { status: 'ACTIVE', planName: 'Gold' },
      opportunity: {
        type: 'OFFER',
        title: 'Penyedia Mesin CNC 5-Axis & Layanan Servis Perawatan Berkala',
        description:
          'Menyediakan mesin CNC 5-Axis impor berstandar CE/ISO dengan teknisi tersertifikasi, suku cadang siap pasang, ' +
          'dan dukungan instalasi ke seluruh Indonesia.',
        budgetMin: 450000000,
        budgetMax: 1400000000,
        priority: 'HIGH',
        visibility: 'PUBLIC',
        tags: ['manufaktur', 'iso-certified', 'ekspor'],
      },
    },
    {
      supabaseId: 'dev-investor-uuid-0000-0000000004',
      email: 'investor.capital@sinaptex.test',
      phone: '+628140000004',
      fullName: 'Michael Tan',
      bio: 'Investment Partner di Nusantara Ventures',
      location: 'Jakarta Pusat',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      reputationScore: 90,
      trustScore: 92,
      roles: ['INVESTOR'],
      party: {
        name: 'Nusantara Growth Capital',
        isCompany: true,
        categoryId: techCategory ? techCategory.id : null,
        description: 'Firma modal ventura berfokus pada pendanaan rantai pasok dan inovasi teknologi B2B',
        location: 'SCBD, Jakarta Selatan',
        npwp: '04.567.890.1-044.000',
        nib: '9120004445556',
        verificationStatus: 'VERIFIED',
      },
      membership: { status: 'ACTIVE', planName: 'Enterprise' },
    },
  ];

  for (let i = 0; i < testUserConfigs.length; i++) {
    let item = testUserConfigs[i];

    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { supabaseId: item.supabaseId, phone: item.phone },
      create: {
        supabaseId: item.supabaseId,
        email: item.email,
        phone: item.phone,
      },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        fullName: item.fullName,
        bio: item.bio,
        location: item.location,
        phone: item.phone,
        accountStatus: item.accountStatus,
        verificationStatus: item.verificationStatus,
        reputationScore: item.reputationScore,
        trustScore: item.trustScore,
      },
      create: {
        userId: user.id,
        fullName: item.fullName,
        bio: item.bio,
        location: item.location,
        phone: item.phone,
        accountStatus: item.accountStatus,
        verificationStatus: item.verificationStatus,
        reputationScore: item.reputationScore,
        trustScore: item.trustScore,
      },
    });

    let partyRecord = null;
    if (item.party) {
      partyRecord = await prisma.party.findFirst({
        where: { ownerId: profile.id, name: item.party.name },
      });

      if (!partyRecord) {
        partyRecord = await prisma.party.create({
          data: {
            ownerId: profile.id,
            name: item.party.name,
            isCompany: item.party.isCompany,
            categoryId: item.party.categoryId,
            description: item.party.description,
            location: item.party.location,
            npwp: item.party.npwp,
            nib: item.party.nib,
            verificationStatus: item.party.verificationStatus,
          },
        });
      }
    }

    if (item.roles && item.roles.length) {
      for (let j = 0; j < item.roles.length; j++) {
        let role = item.roles[j];

        const existingRole = await prisma.businessRole.findFirst({
          where: {
            profileId: profile.id,
            role,
            partyId: partyRecord ? partyRecord.id : null,
          },
        });
        if (!existingRole) {
          await prisma.businessRole.create({
            data: {
              profileId: profile.id,
              role,
              partyId: partyRecord ? partyRecord.id : null,
            },
          });
        }
      }
    }

    if (item.membership) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      await prisma.membership.upsert({
        where: { profileId: profile.id },
        update: {
          status: item.membership.status,
          activatedAt: now,
          expiresAt,
        },
        create: {
          profileId: profile.id,
          status: item.membership.status,
          activatedAt: now,
          expiresAt,
        },
      });
    }

    if (item.opportunity && partyRecord) {
      const existingOpp = await prisma.opportunity.findFirst({
        where: { partyId: partyRecord.id, title: item.opportunity.title },
      });

      if (!existingOpp) {
        await prisma.opportunity.create({
          data: {
            partyId: partyRecord.id,
            type: item.opportunity.type,
            title: item.opportunity.title,
            description: item.opportunity.description,
            budgetMin: item.opportunity.budgetMin,
            budgetMax: item.opportunity.budgetMax,
            priority: item.opportunity.priority,
            visibility: item.opportunity.visibility,
            status: 'ACTIVE',
            tags: item.opportunity.tags || [],
            location: partyRecord.location,
            categoryId: partyRecord.categoryId,
          },
        });
      }
    }
  }
  console.log('  ✓ Test users seeded');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Starting database seeding...');

  await seedBoostPlans();
  await seedCategories();
  await seedCapabilitiesAndTags();
  await seedGeoCurrencyLanguage();
  await seedMembership();
  await seedDiagnosisKnowledgeBase();
  await seedCmsLegalAndFaq();
  await seedTestUsers();

  console.log('Comprehensive database seeding completed successfully.');
}

main()
  .catch((err) => {
    console.error('Database seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
