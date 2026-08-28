const prisma = require('../../config/prisma');
const intentConfig = require('../../config/intent.config');
const { textSimilarity } = require('../../shared/textSimilarity');
const { findSolutionCategory, startInquiry } = require('../decision/decision.service');
const { startDiagnosis } = require('../business-diagnosis/diagnosis.service');
const logger = require('../../core/logger');

/**
 * INTENT ENGINE (Phase 21 — pintu masuk paling depan)
 * -----------------------------------------------------
 * User
 *   │
 *   ▼
 * Intent Engine  <- kita di sini
 *   │
 *   ├── DIRECT_SEARCH ─────────▶ Matching Engine (Phase 08/business-matching)
 *   └── NEEDS_DIAGNOSIS ───────▶ Business Intelligence
 *                                 ├─ PRODUCT_CLARIFICATION → Decision Engine (Phase 19)
 *                                 └─ BUSINESS_DIAGNOSIS    → Diagnosis Engine (Phase 20)
 *
 * Klasifikasi 100% deterministik (lexicon di intent.config.js) — TIDAK ada
 * panggilan AI generatif untuk memutuskan rute. Kalau tidak yakin, jawabannya
 * AMBIGUOUS dan Engine ini akan bertanya balik, bukan menebak (konsisten
 * dengan prinsip anti-halusinasi di docs/business-decision-philosophy.md).
 */

function normalize(text) {
  return (text || '').toLowerCase().trim();
}

function findFirstMatch(text, keywords) {
  return keywords.find((kw) => text.includes(kw)) || null;
}

/**
 * Klasifikasi berbasis pola SAJA (sinkron, tidak menyentuh DB) — inilah bagian
 * yang diuji unit test murni (tests/unit/intent.service.test.js).
 *
 * @returns {{ category: string, subtype: string|null, matchedPattern: string|null }}
 *   category NEEDS_DIAGNOSIS/DIRECT_SEARCH/AMBIGUOUS, ATAU 'PENDING_KB_LOOKUP'
 *   (butuh lookup async ke basis pengetahuan SolutionCategory — lihat classifyIntent).
 */
function classifyPattern(rawText) {
  const text = normalize(rawText);

  // Rule 1: pertanyaan/interogatif -> selalu NEEDS_DIAGNOSIS
  const interrogative = findFirstMatch(text, intentConfig.interrogativePatterns);
  if (interrogative) {
    return {
      category: 'NEEDS_DIAGNOSIS',
      subtype: 'ADVISORY_OR_ANALYSIS',
      matchedPattern: interrogative,
    };
  }

  // Rule 2: gejala/tren negatif -> NEEDS_DIAGNOSIS
  const symptom = findFirstMatch(text, intentConfig.symptomKeywords);
  if (symptom) {
    return { category: 'NEEDS_DIAGNOSIS', subtype: 'BUSINESS_DIAGNOSIS', matchedPattern: symptom };
  }

  const acquisitionVerb = findFirstMatch(text, intentConfig.acquisitionVerbs);

  // Rule 3: cari PIHAK (supplier/buyer/investor/partner) -> DIRECT_SEARCH, tidak perlu diagnosis JTBD
  if (acquisitionVerb) {
    const role = findFirstMatch(text, intentConfig.roleKeywords);
    if (role) {
      return {
        category: 'DIRECT_SEARCH',
        subtype: 'SEARCH_PARTY_ROLE',
        matchedPattern: `${acquisitionVerb} + ${role}`,
      };
    }
    // Rule 4: ada niat akuisisi tapi bukan pencarian pihak -> perlu cek basis
    // pengetahuan SolutionCategory (async, lihat classifyIntent) sebelum
    // diputuskan DIRECT_SEARCH atau NEEDS_DIAGNOSIS/PRODUCT_CLARIFICATION.
    return { category: 'PENDING_KB_LOOKUP', subtype: null, matchedPattern: acquisitionVerb };
  }

  // Rule 5: tidak ada pola yang cocok sama sekali -> JUJUR mengaku tidak yakin, jangan menebak
  return { category: 'AMBIGUOUS', subtype: null, matchedPattern: null };
}

/**
 * Wrapper async: melengkapi classifyPattern() dengan lookup basis pengetahuan
 * Phase 19 untuk kasus PENDING_KB_LOOKUP (mis. "butuh CRM" vs "beli mesin").
 */
async function classifyIntent(rawText) {
  const patternResult = classifyPattern(rawText);
  if (patternResult.category !== 'PENDING_KB_LOOKUP') return patternResult;

  const category = await findSolutionCategory(rawText);
  if (category) {
    return {
      category: 'NEEDS_DIAGNOSIS',
      subtype: 'PRODUCT_CLARIFICATION',
      matchedPattern: `${patternResult.matchedPattern} + basis pengetahuan: "${category.name}"`,
    };
  }
  return {
    category: 'DIRECT_SEARCH',
    subtype: 'SEARCH_GENERIC_PRODUCT',
    matchedPattern: patternResult.matchedPattern,
  };
}

// ---------- Orkestrasi: klasifikasi + langsung delegasikan ke engine yang tepat ----------

async function searchOpportunitiesDirect(rawText) {
  const opportunities = await prisma.opportunity.findMany({
    where: {
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      OR: [
        { title: { contains: rawText, mode: 'insensitive' } },
        { description: { contains: rawText, mode: 'insensitive' } },
        {
          tags: {
            hasSome: rawText
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2),
          },
        },
      ],
    },
    include: { party: { select: { id: true, name: true, verificationStatus: true } } },
    orderBy: [{ boost: { priorityWeight: 'desc' } }, { createdAt: 'desc' }],
    take: intentConfig.directSearchResultLimit,
  });
  return opportunities;
}

/** Cocokkan rawText ke BusinessSymptom lewat text similarity — deterministik, bukan tebakan. */
async function matchBusinessSymptom(rawText) {
  const symptoms = await prisma.businessSymptom.findMany();
  const bestMatch = symptoms.reduce(
    (best, symptom) => {
      const score = textSimilarity(rawText, `${symptom.name} ${symptom.description || ''}`);
      if (score > best.score) {
        return { symptom, score };
      }
      return best;
    },
    { symptom: null, score: 0 }
  );

  return bestMatch.score >= intentConfig.symptomMatchThreshold ? bestMatch.symptom : null;
}

/**
 * Titik masuk utama: klasifikasi + orkestrasi ke Matching Engine atau Business
 * Intelligence (Decision/Diagnosis Engine), plus log keputusan untuk audit &
 * analytics. Tidak pernah memaksa keputusan kalau tidak yakin (AMBIGUOUS).
 */
async function handleIntent({ rawText, profileId, partyId }) {
  const classification = await classifyIntent(rawText);
  let routedTo = null;
  let payload = null;

  if (classification.category === 'DIRECT_SEARCH') {
    routedTo = 'business-matching';
    const opportunities = await searchOpportunitiesDirect(rawText);
    payload = {
      engine: 'matching',
      opportunities,
      note:
        opportunities.length > 0
          ? `Ditemukan ${opportunities.length} Opportunity yang relevan.`
          : 'Tidak ada Opportunity yang cocok saat ini. Coba GET /opportunities dengan filter lain, ' +
            'atau buat Opportunity NEED baru supaya Matching Engine bisa mencarikan lawan yang cocok nanti.',
    };
  } else if (classification.category === 'NEEDS_DIAGNOSIS') {
    routedTo = 'business-intelligence';

    if (classification.subtype === 'PRODUCT_CLARIFICATION') {
      const result = await startInquiry({ statedWant: rawText, profileId });
      payload = { engine: 'decision', ...result };
    } else {
      // ADVISORY_OR_ANALYSIS atau BUSINESS_DIAGNOSIS -> cari BusinessSymptom yang cocok
      const symptom = await matchBusinessSymptom(rawText);
      if (symptom) {
        const result = await startDiagnosis({ symptomId: symptom.id, partyId, profileId });
        payload = {
          engine: 'business-diagnosis',
          matchedSymptom: { id: symptom.id, name: symptom.name },
          ...result,
        };
      } else {
        // JUJUR: terdeteksi ini masalah bisnis, tapi tidak yakin gejala spesifiknya.
        // Jangan menebak salah satu symptom secara paksa.
        const availableSymptoms = await prisma.businessSymptom.findMany({
          select: { id: true, name: true },
        });
        payload = {
          engine: 'business-diagnosis',
          alert:
            'Kami mendeteksi ini terkait masalah/performa bisnis, tapi belum yakin gejala spesifiknya. ' +
            'Silakan pilih dari daftar gejala yang tersedia dan mulai sesi diagnosis manual.',
          availableSymptoms,
        };
      }
    }
  } else {
    // AMBIGUOUS: tidak menebak. Kasih dua opsi eksplisit ke client.
    payload = {
      alert:
        'Kami belum yakin apakah ini permintaan pencarian (produk/mitra) atau masalah bisnis yang perlu ' +
        'didiagnosis. Coba jelaskan lebih spesifik, atau pilih salah satu opsi.',
      options: [
        { label: 'Saya mau cari sesuatu', action: 'GET /api/v1/opportunities?search=...' },
        { label: 'Saya punya masalah bisnis', action: 'GET /api/v1/business-diagnosis/symptoms' },
      ],
    };
  }

  const log = await prisma.intentLog.create({
    data: {
      profileId,
      rawText,
      category: classification.category,
      subtype: classification.subtype,
      matchedPattern: classification.matchedPattern,
      routedTo,
    },
  });

  logger.info('Intent classified', {
    intentLogId: log.id,
    category: classification.category,
    subtype: classification.subtype,
    routedTo,
  });

  return { classification, routedTo, ...payload };
}

module.exports = {
  classifyPattern,
  classifyIntent,
  handleIntent,
  searchOpportunitiesDirect,
  matchBusinessSymptom,
};
