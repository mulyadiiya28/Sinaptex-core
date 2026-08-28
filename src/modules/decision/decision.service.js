const prisma = require('../../config/prisma');
const decisionConfig = require('../../config/decision.config');
const { tokenize, jaccard, textSimilarity } = require('../../shared/textSimilarity');
const logger = require('../../core/logger');

/**
 * BUSINESS DECISION ENGINE (Jobs-to-be-Done / Root-Cause Engine)
 * -----------------------------------------------------------------
 * Filosofi (lihat docs/business-decision-philosophy.md untuk penjelasan penuh):
 *   Orang tidak benar-benar butuh bor — mereka butuh lubang di dinding.
 *   Orang tidak benar-benar butuh rumah — mereka butuh tempat berteduh,
 *   pengakuan sosial, atau instrumen investasi. Orang tidak benar-benar
 *   butuh CRM — mereka butuh supaya follow-up pelanggan tidak bocor.
 *
 * Engine ini duduk DI ATAS Matching Engine: sebelum mencocokkan Opportunity,
 * ia dulu mendiagnosis Job (kebutuhan sebenarnya) di balik permintaan
 * permukaan (statedWant) memakai basis pengetahuan TERSTRUKTUR di database
 * (RootProblem -> JobToBeDone -> SolutionCategory), bukan generatif AI bebas.
 * Ini yang membuat diagnosis konsisten meski model AI di baliknya berganti.
 *
 * PRINSIP ANTI-HALUSINASI: setiap keluaran punya confidenceScore &
 * dataSufficiency eksplisit. Kalau basis pengetahuan tidak punya data, atau
 * tidak ada Opportunity nyata yang menjawab Job yang terdiagnosis, engine
 * WAJIB bilang jujur (dataGapAlert) — tidak pernah mengarang solusi.
 */

// ---------- Step 1: cari SolutionCategory dari permintaan permukaan (statedWant) ----------

/**
 * Keyword-overlap lookup yang deterministik (bukan tebakan AI) — bandingkan
 * token dari statedWant terhadap SolutionCategory.keywords dan SolutionCategory.name.
 */
async function findSolutionCategory(statedWant) {
  const wantTokens = tokenize(statedWant);
  const categories = await prisma.solutionCategory.findMany({
    include: { jobMappings: { include: { job: { include: { clarifyingQuestions: true } } } } },
  });

  return (
    categories.reduce((best, category) => {
      const nameTokens = tokenize(category.name);
      const keywordTokens = new Set(category.keywords.flatMap((k) => [...tokenize(k)]));
      const categoryTokens = new Set([...nameTokens, ...keywordTokens]);

      const overlap = [...wantTokens].filter((t) => categoryTokens.has(t)).length;
      const score = overlap + jaccard(wantTokens, categoryTokens);

      if (overlap >= decisionConfig.minKeywordOverlap && score > (best?.score ?? 0)) {
        return { category, score };
      }
      return best;
    }, null)?.category || null
  );
}

// ---------- Step 2: mulai sesi diagnosis (Inquiry) ----------

/**
 * Memulai DecisionInquiry baru dari permintaan mentah user. TIDAK menebak Job
 * secara generatif — kalau statedWant tidak match SolutionCategory manapun di
 * basis pengetahuan, engine JUJUR mengaku belum punya data (CLOSED_NO_DATA)
 * daripada mengarang jawaban.
 */
async function diagnose(inquiryId) {
  const inquiry = await prisma.decisionInquiry.findUnique({
    where: { id: inquiryId },
    include: { answers: true },
  });
  if (!inquiry) throw new Error('Inquiry not found');
  if (!inquiry.matchedSolutionCategoryId)
    throw new Error('Inquiry has no matched SolutionCategory yet');

  const category = await prisma.solutionCategory.findUnique({
    where: { id: inquiry.matchedSolutionCategoryId },
    include: { jobMappings: { include: { job: { include: { clarifyingQuestions: true } } } } },
  });

  const answeredQuestionIds = new Set(inquiry.answers.map((a) => a.questionId));

  let bestJob = null;
  let bestScore = -1;
  let totalQuestions = 0;
  let totalAnswered = 0;

  category.jobMappings.forEach((mapping) => {
    const questions = mapping.job.clarifyingQuestions;
    totalQuestions += questions.length;
    const answeredForThisJob = questions.filter((q) => answeredQuestionIds.has(q.id)).length;
    totalAnswered += answeredForThisJob;

    const ratio = questions.length > 0 ? answeredForThisJob / questions.length : 0;
    const score = ratio * 0.8 + mapping.relevance * 0.2;

    if (score > bestScore || (questions.length === 0 && bestJob === null)) {
      bestScore = score;
      bestJob = mapping.job;
    }
  });

  let answerCoverage = 0;
  if (totalQuestions > 0) answerCoverage = totalAnswered / totalQuestions;
  else if (bestJob) answerCoverage = 1;

  const dominance = category.jobMappings.length > 1 ? Math.max(0, Math.min(1, bestScore)) : 1;
  const confidenceScore =
    Math.round(Math.min(1, answerCoverage * 0.6 + dominance * 0.4) * 1000) / 1000;

  let dataSufficiency = 'INSUFFICIENT';
  if (confidenceScore >= decisionConfig.confidence.minSufficient) dataSufficiency = 'SUFFICIENT';
  else if (confidenceScore >= decisionConfig.confidence.minPartial) dataSufficiency = 'PARTIAL';

  const status = dataSufficiency === 'SUFFICIENT' ? 'DIAGNOSED' : 'OPEN';

  const updated = await prisma.decisionInquiry.update({
    where: { id: inquiryId },
    data: {
      diagnosedJobId: bestJob ? bestJob.id : null,
      confidenceScore,
      dataSufficiency,
      status,
    },
    include: { diagnosedJob: true, matchedSolutionCategory: true },
  });

  const remainingQuestions =
    status === 'DIAGNOSED'
      ? []
      : category.jobMappings.flatMap((m) =>
          m.job.clarifyingQuestions
            .filter((q) => !answeredQuestionIds.has(q.id))
            .map((q) => ({ id: q.id, jobId: m.job.id, question: q.question }))
        );

  return { inquiry: updated, alert: null, pendingQuestions: remainingQuestions };
}

async function startInquiry({ statedWant, profileId }) {
  const category = await findSolutionCategory(statedWant);

  if (!category) {
    const inquiry = await prisma.decisionInquiry.create({
      data: {
        profileId,
        statedWant,
        status: 'CLOSED_NO_DATA',
        dataSufficiency: 'INSUFFICIENT',
        confidenceScore: 0,
      },
    });
    logger.info('Decision inquiry: no knowledge-base match, honest no-data close', {
      inquiryId: inquiry.id,
      statedWant,
    });
    return {
      inquiry,
      alert:
        'Kami belum punya basis pengetahuan untuk kebutuhan ini. Kami tidak akan menebak — ' +
        'silakan hubungi admin untuk menambahkan kategori baru, atau coba jelaskan dengan kata lain.',
      pendingQuestions: [],
    };
  }

  const candidateJobs = category.jobMappings
    .slice()
    .sort((a, b) => b.relevance - a.relevance)
    .map((m) => m.job);

  const inquiry = await prisma.decisionInquiry.create({
    data: {
      profileId,
      statedWant,
      matchedSolutionCategoryId: category.id,
      status: 'OPEN',
      dataSufficiency: 'INSUFFICIENT',
      confidenceScore: 0,
    },
  });

  // Kalau SolutionCategory ini cuma punya SATU Job yang dipetakan (tidak
  // ambigu), boleh langsung didiagnosis tanpa perlu klarifikasi — contoh:
  // "Bor Listrik" -> hanya satu Job "melubangi dinding", tidak perlu ditanya lagi.
  if (decisionConfig.autoResolveWhenUnambiguous && candidateJobs.length === 1) {
    return diagnose(inquiry.id);
  }

  const pendingQuestions = candidateJobs.flatMap((job) =>
    job.clarifyingQuestions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((q) => ({ id: q.id, jobId: job.id, question: q.question }))
  );

  return { inquiry, alert: null, pendingQuestions, candidateJobCount: candidateJobs.length };
}

// ---------- Step 3: jawab pertanyaan klarifikasi ----------

async function submitAnswer({ inquiryId, questionId, answer }) {
  const inquiry = await prisma.decisionInquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry) throw new Error('Inquiry not found');
  if (inquiry.status !== 'OPEN')
    throw new Error(`Inquiry is already ${inquiry.status}, cannot answer further`);

  await prisma.decisionInquiryAnswer.upsert({
    where: { inquiryId_questionId: { inquiryId, questionId } },
    update: { answer },
    create: { inquiryId, questionId, answer },
  });

  return diagnose(inquiryId);
}

/**
 * Menghitung ulang diagnosis (Job mana yang paling mungkin) berdasarkan
 * pertanyaan yang sudah dijawab sejauh ini. Job dengan proporsi pertanyaan
 * terjawab TERTINGGI (relatif terhadap total pertanyaan Job itu) yang menang,
 * bobot kedua dari `relevance` mapping. Ini deterministik, bisa diaudit —
 * bukan black-box.
 */
// ---------- Step 4: cari Opportunity NYATA yang menjawab Job terdiagnosis ----------

/**
 * Sekali Job terdiagnosis dengan cukup yakin, cari Opportunity (OFFER, ACTIVE,
 * PUBLIC) yang benar-benar ada di platform dan relevan dengan Job tersebut.
 * KALAU TIDAK ADA — engine tidak mengarang; ia membuat satu DecisionRecommendation
 * ber-flag `isDataGapAlert: true` yang menjelaskan Job apa yang ditemukan, plus
 * pengakuan jujur bahwa belum ada solusi tersedia di platform.
 */
async function getRecommendations(inquiryId) {
  const inquiry = await prisma.decisionInquiry.findUnique({
    where: { id: inquiryId },
    include: { diagnosedJob: true, matchedSolutionCategory: true, recommendations: true },
  });
  if (!inquiry) throw new Error('Inquiry not found');

  if (inquiry.status === 'CLOSED_NO_DATA') {
    return {
      inquiry,
      recommendations: [],
      alert: 'Basis pengetahuan tidak punya data untuk permintaan ini — lihat inquiry.statedWant.',
    };
  }

  if (!inquiry.diagnosedJobId || inquiry.status !== 'DIAGNOSED') {
    throw new Error(
      'Inquiry belum terdiagnosis dengan cukup yakin. Jawab pertanyaan klarifikasi dulu (lihat pendingQuestions).'
    );
  }

  // Sudah pernah direkomendasikan sebelumnya? Kembalikan hasil yang sama (idempotent).
  if (inquiry.recommendations.length > 0) {
    return { inquiry, recommendations: inquiry.recommendations, alert: null };
  }

  const job = inquiry.diagnosedJob;
  const category = inquiry.matchedSolutionCategory;
  const referenceText = `${job.statement} ${category?.name || ''} ${(category?.keywords || []).join(' ')}`;

  const candidates = await prisma.opportunity.findMany({
    where: { type: 'OFFER', status: 'ACTIVE', visibility: 'PUBLIC' },
    include: { party: { select: { id: true, name: true, verificationStatus: true } } },
    take: 300,
  });

  const scored = candidates
    .map((opp) => {
      const relevance = textSimilarity(
        referenceText,
        `${opp.title} ${opp.description} ${opp.tags.join(' ')}`
      );
      return { opp, relevance };
    })
    .filter((s) => s.relevance >= decisionConfig.minSolutionRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  let recommendations;
  if (scored.length === 0) {
    const gapRecommendation = await prisma.decisionRecommendation.create({
      data: {
        inquiryId,
        opportunityId: null,
        isDataGapAlert: true,
        confidence: inquiry.confidenceScore,
        reasoning:
          `Kebutuhan sebenarnya yang teridentifikasi: "${job.statement}". ` +
          'Namun saat ini belum ada Need/Offer di platform yang cocok menjawabnya. ' +
          'Kami memilih untuk tidak merekomendasikan apa pun daripada mengarang solusi yang tidak benar-benar tersedia.',
      },
    });
    recommendations = [gapRecommendation];
  } else {
    recommendations = await Promise.all(
      scored.map(({ opp, relevance }) =>
        prisma.decisionRecommendation.create({
          data: {
            inquiryId,
            opportunityId: opp.id,
            isDataGapAlert: false,
            confidence: Math.round(inquiry.confidenceScore * relevance * 1000) / 1000,
            reasoning:
              `Kebutuhan sebenarnya yang teridentifikasi: "${job.statement}". ` +
              `Opportunity "${opp.title}" oleh ${opp.party.name} relevan (kemiripan konten ${Math.round(relevance * 100)}%).`,
          },
        })
      )
    );
  }

  await prisma.decisionInquiry.update({
    where: { id: inquiryId },
    data: { status: 'RECOMMENDED' },
  });

  return { inquiry, recommendations, alert: null };
}

// ---------- Step 5 (Phase 22): keputusan untuk RootCause dari Business Diagnosis Engine ----------

/** Helper reusable: cari Opportunity nyata yang relevan dengan sebuah teks referensi (Job statement, dst). */
async function searchRelevantOpportunities(referenceText, limit = 3) {
  const candidates = await prisma.opportunity.findMany({
    where: { type: 'OFFER', status: 'ACTIVE', visibility: 'PUBLIC' },
    include: { party: { select: { id: true, name: true, verificationStatus: true } } },
    take: 300,
  });

  return candidates
    .map((opp) => ({
      opp,
      relevance: textSimilarity(
        referenceText,
        `${opp.title} ${opp.description} ${opp.tags.join(' ')}`
      ),
    }))
    .filter((s) => s.relevance >= decisionConfig.minSolutionRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * BUSINESS DECISION ENGINE — titik masuk untuk hasil Business Diagnosis Engine
 * (Phase 20). Diagnosis Engine cuma menjawab "apa akar masalahnya"
 * (BusinessRootCause); fungsi inilah yang memutuskan "apa yang harus dilakukan
 * soal itu" lewat BusinessDecision (recommendationType + JobToBeDone opsional)
 * — persis prinsip yang sama dengan getRecommendations() di atas (untuk alur
 * permintaan langsung), cuma sumbernya BusinessDiagnosis, bukan DecisionInquiry.
 */
async function decideForRootCause(diagnosisId) {
  const diagnosis = await prisma.businessDiagnosis.findUnique({
    where: { id: diagnosisId },
    include: {
      diagnosedRootCause: { include: { decision: { include: { job: true } } } },
      recommendations: true,
    },
  });
  if (!diagnosis) throw new Error('Diagnosis session not found');

  if (diagnosis.status === 'INSUFFICIENT_DATA') {
    return {
      diagnosis,
      recommendations: [],
      alert:
        'Kombinasi data yang terkumpul untuk gejala ini belum ada di basis pengetahuan diagnosis kami. ' +
        'Kami tidak akan menebak akar masalahnya — silakan hubungi admin untuk melengkapi basis pengetahuan.',
    };
  }
  if (diagnosis.status !== 'DIAGNOSED') {
    throw new Error(
      'Diagnosis belum selesai. Lengkapi data yang diminta dulu (lihat pendingFactors).'
    );
  }
  if (diagnosis.recommendations.length > 0) {
    return { diagnosis, recommendations: diagnosis.recommendations, alert: null };
  }

  const rootCause = diagnosis.diagnosedRootCause;
  const { decision } = rootCause;
  if (!decision) {
    // Gap konfigurasi: root cause terdiagnosis tapi belum punya BusinessDecision terkait.
    const gap = await prisma.businessDiagnosisRecommendation.create({
      data: {
        diagnosisId,
        type: 'ADVISORY',
        isDataGapAlert: true,
        confidence: diagnosis.confidenceScore,
        reasoning:
          `Akar masalah "${rootCause.name}" terdiagnosis, tapi belum ada BusinessDecision yang ` +
          'menentukan tindak lanjutnya — ini gap konfigurasi, mohon hubungi admin.',
      },
    });
    return { diagnosis, recommendations: [gap], alert: null };
  }

  const recs = [];

  if (decision.recommendationType === 'ADVISORY_ONLY' || decision.recommendationType === 'HYBRID') {
    const advisory = await prisma.advisoryContent.findFirst({
      where: { decisionId: decision.id, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
    });

    const advisoryReason = advisory
      ? `Akar masalah teridentifikasi: "${rootCause.name}" — ${rootCause.explanation}`
      : `Akar masalah teridentifikasi: "${rootCause.name}". Namun saran untuk kasus ini belum melalui review admin, jadi belum bisa kami tampilkan sebagai rekomendasi resmi.`;

    recs.push(
      await prisma.businessDiagnosisRecommendation.create({
        data: {
          diagnosisId,
          type: 'ADVISORY',
          advisoryContentId: advisory?.id ?? null,
          confidence: diagnosis.confidenceScore,
          isDataGapAlert: !advisory,
          reasoning: advisoryReason,
        },
      })
    );
  }

  if (
    decision.recommendationType === 'MATCH_OPPORTUNITY' ||
    decision.recommendationType === 'HYBRID'
  ) {
    if (!decision.job) {
      recs.push(
        await prisma.businessDiagnosisRecommendation.create({
          data: {
            diagnosisId,
            type: 'OPPORTUNITY_MATCH',
            opportunityId: null,
            confidence: diagnosis.confidenceScore,
            isDataGapAlert: true,
            reasoning:
              `Akar masalah "${rootCause.name}" seharusnya diarahkan ke solusi marketplace, tapi belum ` +
              'dikaitkan ke basis pengetahuan Job — ini gap konfigurasi, mohon hubungi admin.',
          },
        })
      );
    } else {
      const matches = await searchRelevantOpportunities(decision.job.statement);
      if (matches.length === 0) {
        recs.push(
          await prisma.businessDiagnosisRecommendation.create({
            data: {
              diagnosisId,
              type: 'OPPORTUNITY_MATCH',
              opportunityId: null,
              confidence: diagnosis.confidenceScore,
              isDataGapAlert: true,
              reasoning:
                `Akar masalah teridentifikasi: "${rootCause.name}" (${decision.job.statement}). ` +
                'Namun belum ada Need/Offer nyata di platform yang menjawabnya saat ini.',
            },
          })
        );
      } else {
        const opportunityRecommendations = await Promise.all(
          matches.map(async ({ opp, relevance }) =>
            prisma.businessDiagnosisRecommendation.create({
              data: {
                diagnosisId,
                type: 'OPPORTUNITY_MATCH',
                opportunityId: opp.id,
                confidence: Math.round(diagnosis.confidenceScore * relevance * 1000) / 1000,
                isDataGapAlert: false,
                reasoning:
                  `Akar masalah teridentifikasi: "${rootCause.name}". Opportunity "${opp.title}" oleh ` +
                  `${opp.party.name} relevan untuk menjawabnya (kemiripan konten ${Math.round(relevance * 100)}%).`,
              },
            })
          )
        );
        recs.push(...opportunityRecommendations);
      }
    }
  }

  return { diagnosis, recommendations: recs, alert: null };
}

module.exports = {
  findSolutionCategory,
  startInquiry,
  submitAnswer,
  diagnose,
  getRecommendations,
  decideForRootCause,
  searchRelevantOpportunities,
};
