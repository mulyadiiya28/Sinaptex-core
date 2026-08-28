const prisma = require('../../config/prisma');
const diagnosisConfig = require('../../config/diagnosis.config');
const { resolveAutoMetric } = require('./metricsResolver');
const logger = require('../../core/logger');

/**
 * BUSINESS DIAGNOSIS ENGINE (Phase 20, disempurnakan Phase 22 — single
 * responsibility murni: SYMPTOM → FACTOR → RULE → ROOT CAUSE, titik).
 * -------------------------------------------------------------------
 * Keputusan "apa yang harus dilakukan" soal root cause yang ditemukan (advisory
 * vs cari Opportunity vs dua-duanya, plus JobToBeDone) SENGAJA TIDAK ada di
 * sini lagi — itu tanggung jawab Business Decision Engine
 * (`src/modules/decision/decision.service.js` -> `decideForRootCause()`).
 * Engine ini berhenti persis di status DIAGNOSED + diagnosedRootCauseId.
 *
 * Auto-tarik dari histori nyata Party di platform (metricsResolver.js) kalau
 * ada, atau diisi manual kalau tidak ada — lewat DiagnosticRule yang
 * deterministik (bisa diaudit, bukan black-box).
 */

// ---------- Helpers: parse & evaluasi kondisi rule ----------

function parseFactorValue(rawValue, dataType) {
  if (dataType === 'BOOLEAN') return rawValue === 'true';
  if (dataType === 'NUMERIC' || dataType === 'PERCENTAGE') return Number(rawValue);
  return rawValue; // CATEGORICAL
}

function evaluateCondition(operator, actualValue, conditionValue) {
  switch (operator) {
    case 'LT':
      return actualValue < conditionValue;
    case 'LTE':
      return actualValue <= conditionValue;
    case 'GT':
      return actualValue > conditionValue;
    case 'GTE':
      return actualValue >= conditionValue;
    case 'EQ':
      return actualValue === conditionValue;
    case 'NEQ':
      return actualValue !== conditionValue;
    case 'IS_TRUE':
      return actualValue === true;
    case 'IS_FALSE':
      return actualValue === false;
    case 'IN':
      return Array.isArray(conditionValue) && conditionValue.includes(actualValue);
    default:
      return false;
  }
}

// ---------- Pattern Detection (Phase 22, informasional saja) ----------

/**
 * Cocokkan rawText ke DiagnosticPattern yang sudah dikenal admin (mis. "Musim
 * Sepi Tahunan") lewat keyword lookup deterministik. HANYA informasional:
 * ditempel ke BusinessDiagnosis.matchedPatternId untuk transparansi
 * Explainable Result, TIDAK mengubah logika evaluateAndUpdate() diam-diam.
 */
async function detectPattern(symptomId, rawText) {
  if (!rawText) return null;
  const patterns = await prisma.diagnosticPattern.findMany({ where: { symptomId } });
  const text = rawText.toLowerCase();

  return (
    patterns.find((pattern) => pattern.keywords.some((kw) => text.includes(kw.toLowerCase()))) ||
    null
  );
}

// ---------- Step 3: evaluasi rule deterministik ----------

async function evaluateAndUpdate(diagnosisId) {
  const diagnosis = await prisma.businessDiagnosis.findUnique({
    where: { id: diagnosisId },
    include: { factorValues: { include: { factor: true } } },
  });
  if (!diagnosis) throw new Error('Diagnosis session not found');

  const rules = await prisma.diagnosticRule.findMany({
    where: { symptomId: diagnosis.symptomId },
    orderBy: { priority: 'asc' },
    include: { rootCause: true },
  });

  const valueMap = new Map(
    diagnosis.factorValues.map((fv) => [
      fv.factorId,
      { raw: fv.value, source: fv.source, dataType: fv.factor.dataType },
    ])
  );

  let matchedRule = null;
  const missingFactorIds = new Set();

  matchedRule = rules.find((rule) => {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const missing = conditions.filter((c) => !valueMap.has(c.factorId));

    if (missing.length > 0) {
      missing.forEach((c) => missingFactorIds.add(c.factorId));
      return false;
    }

    return conditions.every((c) => {
      const entry = valueMap.get(c.factorId);
      const actual = parseFactorValue(entry.raw, entry.dataType);
      return evaluateCondition(c.operator, actual, c.value);
    });
  });

  let update;
  let pendingFactors = [];

  if (matchedRule) {
    const usedFactorIds = (Array.isArray(matchedRule.conditions) ? matchedRule.conditions : []).map(
      (c) => c.factorId
    );
    const usedSources = usedFactorIds.map((id) => valueMap.get(id)?.source);
    const allAuto = usedSources.length > 0 && usedSources.every((s) => s === 'AUTO_PLATFORM');
    const allManual = usedSources.length > 0 && usedSources.every((s) => s === 'MANUAL_INPUT');
    let confidenceScore = diagnosisConfig.confidenceByProvenance.mixed;

    if (allAuto) confidenceScore = diagnosisConfig.confidenceByProvenance.allAuto;
    else if (allManual) confidenceScore = diagnosisConfig.confidenceByProvenance.allManual;

    update = {
      diagnosedRootCauseId: matchedRule.rootCauseId,
      confidenceScore,
      status: 'DIAGNOSED',
    };
  } else if (missingFactorIds.size > 0) {
    update = { status: 'DATA_COLLECTION' };
    const factors = await prisma.diagnosticFactor.findMany({
      where: { id: { in: [...missingFactorIds] } },
    });
    pendingFactors = factors.map((f) => ({
      id: f.id,
      name: f.name,
      dataType: f.dataType,
      sourceType: f.sourceType,
      unit: f.unit,
    }));
  } else {
    update = { status: 'INSUFFICIENT_DATA' };
    logger.info('Business diagnosis: no rule matched, honest insufficient-data close', {
      diagnosisId,
    });
  }

  const updated = await prisma.businessDiagnosis.update({
    where: { id: diagnosisId },
    data: update,
    include: { diagnosedRootCause: true, symptom: true, matchedPattern: true },
  });

  return { diagnosis: updated, pendingFactors };
}

// ---------- Step 1: mulai sesi diagnosis ----------

async function startDiagnosis({ symptomId, partyId, profileId, rawText }) {
  const symptom = await prisma.businessSymptom.findUnique({
    where: { id: symptomId },
    include: { factors: { orderBy: { order: 'asc' } } },
  });
  if (!symptom) throw new Error('BusinessSymptom not found');

  const matchedPattern = await detectPattern(symptomId, rawText);

  const diagnosis = await prisma.businessDiagnosis.create({
    data: {
      symptomId,
      partyId,
      profileId,
      status: 'DATA_COLLECTION',
      matchedPatternId: matchedPattern?.id,
    },
  });

  const autoResolved = partyId
    ? (
        await Promise.all(
          symptom.factors
            .filter((factor) => factor.sourceType === 'AUTO_PLATFORM')
            .map(async (factor) => {
              const value = await resolveAutoMetric(factor.autoSourceKey, partyId);
              if (value === null || value === undefined) return null;

              await prisma.businessDiagnosisFactorValue.create({
                data: {
                  diagnosisId: diagnosis.id,
                  factorId: factor.id,
                  value: String(value),
                  source: 'AUTO_PLATFORM',
                },
              });

              return { factorId: factor.id, name: factor.name, value, source: 'AUTO_PLATFORM' };
            })
        )
      ).filter(Boolean)
    : [];

  const result = await evaluateAndUpdate(diagnosis.id);
  return {
    ...result,
    autoResolvedFactors: autoResolved,
    matchedPattern: matchedPattern ? { id: matchedPattern.id, name: matchedPattern.name } : null,
  };
}

// ---------- Step 2: jawab/isi factor secara manual ----------

async function submitFactorValue({ diagnosisId, factorId, value }) {
  const diagnosis = await prisma.businessDiagnosis.findUnique({ where: { id: diagnosisId } });
  if (!diagnosis) throw new Error('Diagnosis session not found');
  if (diagnosis.status !== 'DATA_COLLECTION') {
    throw new Error(`Diagnosis is already ${diagnosis.status}, cannot submit more data`);
  }

  const factor = await prisma.diagnosticFactor.findFirst({
    where: { id: factorId, symptomId: diagnosis.symptomId },
  });
  if (!factor) throw new Error('Factor does not belong to this diagnosis symptom');

  await prisma.businessDiagnosisFactorValue.upsert({
    where: { diagnosisId_factorId: { diagnosisId, factorId } },
    update: { value, source: 'MANUAL_INPUT' },
    create: { diagnosisId, factorId, value, source: 'MANUAL_INPUT' },
  });

  return evaluateAndUpdate(diagnosisId);
}

module.exports = {
  startDiagnosis,
  submitFactorValue,
  evaluateAndUpdate,
  detectPattern,
  parseFactorValue,
  evaluateCondition,
};
