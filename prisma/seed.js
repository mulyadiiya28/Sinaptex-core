const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. ---- Boost Plans ----
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
  console.log('  ✓ Boost plans seeded');

  // 2. ---- System Categories (Hierarchical with parent-child structure) ----
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

  for (const cat of defaultCategories) {
    const parent = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name },
    });

    if (cat.children?.length) {
      for (const childName of cat.children) {
        await prisma.category.upsert({
          where: { name: childName },
          update: { parentId: parent.id },
          create: { name: childName, parentId: parent.id },
        });
      }
    }
  }
  console.log('  ✓ Default system categories seeded');

  // 3. ---- Capabilities & Tags Master Data ----
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

  for (const name of standardCapabilities) {
    await prisma.capability.upsert({ where: { name }, update: {}, create: { name } });
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
  for (const name of baseTags) {
    await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('  ✓ Capabilities and tags master data seeded');

  // 4. ---- Master Geo & Currency / Language Data ----
  const indonesia = await prisma.country.upsert({
    where: { code: 'ID' },
    update: {},
    create: { name: 'Indonesia', code: 'ID' },
  });

  const provinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'Bali'];
  const provinceRecords = {};
  for (const name of provinces) {
    provinceRecords[name] = await prisma.province.upsert({
      where: { countryId_name: { countryId: indonesia.id, name } },
      update: {},
      create: { name, countryId: indonesia.id },
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
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
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
  console.log('  ✓ Geographic, currency, and language master data seeded');

  // 5. ---- Membership Plans & Active Pricing Tiers ----
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

  for (const planData of membershipPlans) {
    const plan = await prisma.membershipPlan.upsert({
      where: { name: planData.name },
      update: { durationDays: planData.durationDays, features: planData.features },
      create: {
        name: planData.name,
        durationDays: planData.durationDays,
        features: planData.features,
      },
    });

    const existingActivePrice = await prisma.membershipPricing.findFirst({
      where: { planId: plan.id, status: 'ACTIVE' },
    });
    if (!existingActivePrice) {
      await prisma.membershipPricing.create({
        data: { planId: plan.id, price: planData.price, currency: 'IDR', status: 'ACTIVE' },
      });
    }
  }
  console.log('  ✓ Membership tiers and active pricing rules seeded');

  // 6. ---- Business Decision & Diagnosis Knowledge Base ----
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

  const salesSymptom = await prisma.businessSymptom.upsert({
    where: { name: 'Penjualan Menurun' },
    update: {},
    create: {
      name: 'Penjualan Menurun',
      description: 'Volume atau nilai transaksi yang berhasil closing menurun dibanding periode sebelumnya.',
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
    where: { symptomId: salesSymptom.id, name: 'Staff Penjualan Pernah Ikut Pelatihan Closing?' },
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
      solutionCategoryId_jobId: { solutionCategoryId: salesTrainingCategory.id, jobId: salesTrainingJob.id },
    },
    update: {},
    create: { solutionCategoryId: salesTrainingCategory.id, jobId: salesTrainingJob.id, relevance: 1 },
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

  // 7. ---- Static Pages & FAQs ----
  const staticPages = [
    {
      slug: 'tentang-kami',
      title: 'Tentang Kami',
      content:
        '# Tentang Sinaptex\n\nSinaptex adalah platform B2B Matchmaking & Partnership intelligence modern ' +
        'yang menghubungkan pembeli (Buyer), penyedia jasa/suplier (Supplier), dan investor dengan ' +
        'rekomendasi berbasis Job-To-Be-Done dan analisis reputasi terpercaya.',
    },
    {
      slug: 'cara-kerja',
      title: 'Cara Kerja Platform',
      content:
        '# Cara Kerja Sinaptex\n\n1. Daftarkan akun profil & perusahaan Anda.\n' +
        '2. Publikasikan kebutuhan pengadaan (Need) atau tawarkan solusi kapasitas (Offer).\n' +
        '3. Sistem pencocokan otomatis menganalisis relevansi kategori, budget, dan verifikasi legalitas.\n' +
        '4. Kolaborasi via Direct Chat terenkripsi & amankan pembayaran transaksi lewat sistem Escrow.\n' +
        '5. Selesaikan proyek, catat feedback, dan bangun skor reputasi bisnis Anda.',
    },
    {
      slug: 'syarat-ketentuan',
      title: 'Syarat & Ketentuan',
      content:
        '# Syarat & Ketentuan Layanan\n\nKetentuan penggunaan platform Sinaptex untuk transaksi B2B, ' +
        'verifikasi dokumen legalitas, ketentuan escrow, serta standar etika interaksi antar anggota.',
    },
    {
      slug: 'kebijakan-privasi',
      title: 'Kebijakan Privasi',
      content:
        '# Kebijakan Privasi Data\n\nPerlindungan data pribadi dan informasi perusahaan sesuai standar UU PDP ' +
        'Republik Indonesia dan standar tata kelola data industri.',
    },
  ];

  for (const page of staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content, status: 'PUBLISHED' },
      create: { ...page, status: 'PUBLISHED' },
    });
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
  ];

  for (const faq of faqItems) {
    const existing = await prisma.faqItem.findFirst({ where: { question: faq.question } });
    if (!existing) {
      await prisma.faqItem.create({ data: { ...faq, status: 'PUBLISHED' } });
    }
  }
  console.log('  ✓ Static CMS pages and FAQs seeded');

  // 8. ---- Test Users & Environment Configurations (Dev & Staging) ----
  console.log('  ✓ Seeding development and deployment test accounts...');

  const techCategory = await prisma.category.findUnique({ where: { name: 'Pengembangan Web & Aplikasi' } });
  const mfgCategory = await prisma.category.findUnique({ where: { name: 'Mesin & Perkakas Industri' } });
  const goldPlan = await prisma.membershipPlan.findUnique({ where: { name: 'Gold' } });

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
        categoryId: techCategory?.id,
        description: 'Internal operations, security audit & compliance administration unit',
        location: 'Jakarta Selatan',
        npwp: '01.234.567.8-011.000',
        nib: '9120001112223',
        verificationStatus: 'VERIFIED',
      },
      membership: {
        status: 'ACTIVE',
        planName: 'Enterprise',
      },
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
        categoryId: mfgCategory?.id,
        description: 'Perusahaan manufaktur komponen presisi dan perakitan industri otomotif',
        location: 'Kawasan Industri GIIC Cikarang',
        npwp: '02.345.678.9-022.000',
        nib: '9120002223334',
        verificationStatus: 'VERIFIED',
      },
      membership: {
        status: 'ACTIVE',
        planName: 'Gold',
      },
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
        categoryId: mfgCategory?.id,
        description: 'Distributor resmi dan perakitan mesin perkakas industri bergaransi resmi',
        location: 'Surabaya Industrial Estate Rungkut (SIER)',
        npwp: '03.456.789.0-033.000',
        nib: '9120003334445',
        verificationStatus: 'VERIFIED',
      },
      membership: {
        status: 'ACTIVE',
        planName: 'Gold',
      },
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
        categoryId: techCategory?.id,
        description: 'Firma modal ventura berfokus pada pendanaan rantai pasok dan inovasi teknologi B2B',
        location: 'SCBD, Jakarta Selatan',
        npwp: '04.567.890.1-044.000',
        nib: '9120004445556',
        verificationStatus: 'VERIFIED',
      },
      membership: {
        status: 'ACTIVE',
        planName: 'Enterprise',
      },
    },
  ];

  for (const config of testUserConfigs) {
    const user = await prisma.user.upsert({
      where: { email: config.email },
      update: { supabaseId: config.supabaseId, phone: config.phone },
      create: {
        supabaseId: config.supabaseId,
        email: config.email,
        phone: config.phone,
      },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        fullName: config.fullName,
        bio: config.bio,
        location: config.location,
        phone: config.phone,
        accountStatus: config.accountStatus,
        verificationStatus: config.verificationStatus,
        reputationScore: config.reputationScore,
        trustScore: config.trustScore,
      },
      create: {
        userId: user.id,
        fullName: config.fullName,
        bio: config.bio,
        location: config.location,
        phone: config.phone,
        accountStatus: config.accountStatus,
        verificationStatus: config.verificationStatus,
        reputationScore: config.reputationScore,
        trustScore: config.trustScore,
      },
    });

    // Create or find Party
    let partyRecord = null;
    if (config.party) {
      partyRecord = await prisma.party.findFirst({
        where: { ownerId: profile.id, name: config.party.name },
      });

      if (!partyRecord) {
        partyRecord = await prisma.party.create({
          data: {
            ownerId: profile.id,
            name: config.party.name,
            isCompany: config.party.isCompany,
            categoryId: config.party.categoryId,
            description: config.party.description,
            location: config.party.location,
            npwp: config.party.npwp,
            nib: config.party.nib,
            verificationStatus: config.party.verificationStatus,
          },
        });
      }
    }

    // Assign Roles
    if (config.roles?.length) {
      for (const role of config.roles) {
        const existingRole = await prisma.businessRole.findFirst({
          where: { profileId: profile.id, role, partyId: partyRecord ? partyRecord.id : null },
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

    // Assign Membership
    if (config.membership) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      await prisma.membership.upsert({
        where: { profileId: profile.id },
        update: {
          status: config.membership.status,
          activatedAt: now,
          expiresAt,
        },
        create: {
          profileId: profile.id,
          status: config.membership.status,
          activatedAt: now,
          expiresAt,
        },
      });
    }

    // Seed sample opportunity if present
    if (config.opportunity && partyRecord) {
      const existingOpp = await prisma.opportunity.findFirst({
        where: { partyId: partyRecord.id, title: config.opportunity.title },
      });

      if (!existingOpp) {
        await prisma.opportunity.create({
          data: {
            partyId: partyRecord.id,
            type: config.opportunity.type,
            title: config.opportunity.title,
            description: config.opportunity.description,
            budgetMin: config.opportunity.budgetMin,
            budgetMax: config.opportunity.budgetMax,
            priority: config.opportunity.priority,
            visibility: config.opportunity.visibility,
            status: 'ACTIVE',
            tags: config.opportunity.tags || [],
            location: partyRecord.location,
            categoryId: partyRecord.categoryId,
          },
        });
      }
    }
  }

  console.log('✅ Comprehensive database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
