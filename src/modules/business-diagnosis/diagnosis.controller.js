const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const diagnosisService = require('./diagnosis.service');

// ---------- Public: symptom catalog ----------

const listSymptoms = asyncHandler(async (req, res) => {
  const symptoms = await prisma.businessSymptom.findMany({
    include: { factors: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  return success(res, symptoms);
});

// ---------- Diagnosis session flow ----------

const startDiagnosis = asyncHandler(async (req, res) => {
  const { symptomId, partyId } = req.body;

  if (partyId) {
    const party = await prisma.party.findFirst({ where: { id: partyId, ownerId: req.profile.id } });
    if (!party) throw ApiError.forbidden('You do not own this party');
  }

  try {
    const result = await diagnosisService.startDiagnosis({
      symptomId,
      partyId,
      profileId: req.profile.id,
    });
    return created(res, result, 'Diagnosis session started');
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
});

const getDiagnosis = asyncHandler(async (req, res) => {
  const diagnosis = await prisma.businessDiagnosis.findUnique({
    where: { id: req.params.id },
    include: {
      symptom: true,
      diagnosedRootCause: true,
      factorValues: { include: { factor: true } },
    },
  });
  if (!diagnosis) throw ApiError.notFound('Diagnosis session not found');
  return success(res, diagnosis);
});

const submitFactor = asyncHandler(async (req, res) => {
  const { factorId, value } = req.body;
  try {
    const result = await diagnosisService.submitFactorValue({
      diagnosisId: req.params.id,
      factorId,
      value,
    });
    return success(res, result, 'Factor value recorded');
  } catch (err) {
    throw ApiError.conflict(err.message);
  }
});

const getRecommendations = asyncHandler(async (req, res) => {
  try {
    const result = await diagnosisService.getRecommendations(req.params.id);
    return success(res, result);
  } catch (err) {
    throw ApiError.conflict(err.message);
  }
});

// ---------- Admin: knowledge-base management ----------

const createKnowledge = asyncHandler(async (req, res) => {
  const { symptom, factors, rootCauses } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const createdSymptom = await tx.businessSymptom.upsert({
      where: { name: symptom.name },
      update: { description: symptom.description },
      create: symptom,
    });

    const factorIdByName = Object.fromEntries(
      await Promise.all(
        (factors || []).map(async (f) => {
          const createdFactor = await tx.diagnosticFactor.create({
            data: {
              symptomId: createdSymptom.id,
              name: f.name,
              dataType: f.dataType,
              sourceType: f.sourceType,
              autoSourceKey: f.autoSourceKey,
              unit: f.unit,
              order: f.order ?? 0,
            },
          });
          return [f.name, createdFactor.id];
        })
      )
    );

    await Promise.all(
      (rootCauses || []).map(async (rc) => {
        const rootCause = await tx.businessRootCause.create({
          data: {
            symptomId: createdSymptom.id,
            name: rc.name,
            explanation: rc.explanation,
            recommendationType: rc.recommendationType,
            jobId: rc.jobId,
          },
        });

        await Promise.all(
          (rc.rules || []).map(async (rule) =>
            tx.diagnosticRule.create({
              data: {
                symptomId: createdSymptom.id,
                rootCauseId: rootCause.id,
                priority: rule.priority ?? 0,
                conditions: (rule.conditions || []).map((c) => ({
                  ...c,
                  factorId: factorIdByName[c.factorName] || c.factorId,
                })),
              },
            })
          )
        );

        await Promise.all(
          (rc.advisoryContents || []).map(async (advisory) =>
            tx.advisoryContent.create({
              data: {
                rootCauseId: rootCause.id,
                title: advisory.title,
                body: advisory.body,
                authorType: advisory.authorType || 'ADMIN',
                status: 'DRAFT',
              },
            })
          )
        );

        return rootCause;
      })
    );

    return tx.businessSymptom.findUnique({
      where: { id: createdSymptom.id },
      include: {
        factors: true,
        rootCauses: { include: { rules: true, advisoryContents: true, job: true } },
      },
    });
  });

  return created(res, result, 'Knowledge entry created');
});

const listKnowledge = asyncHandler(async (req, res) => {
  const symptoms = await prisma.businessSymptom.findMany({
    include: {
      factors: true,
      rootCauses: { include: { rules: true, advisoryContents: true, job: true } },
    },
    orderBy: { name: 'asc' },
  });
  return success(res, symptoms);
});

// Admin review gate: draft (termasuk draft AI) baru boleh ditampilkan ke user setelah ini.
const publishAdvisory = asyncHandler(async (req, res) => {
  const advisory = await prisma.advisoryContent.findUnique({ where: { id: req.params.id } });
  if (!advisory) throw ApiError.notFound('Advisory content not found');

  const updated = await prisma.advisoryContent.update({
    where: { id: advisory.id },
    data: { status: 'PUBLISHED', reviewedBy: req.profile.id, reviewedAt: new Date() },
  });
  return success(res, updated, 'Advisory content published');
});

module.exports = {
  listSymptoms,
  startDiagnosis,
  getDiagnosis,
  submitFactor,
  getRecommendations,
  createKnowledge,
  listKnowledge,
  publishAdvisory,
};
