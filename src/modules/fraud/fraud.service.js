const prisma = require('../../config/prisma');
const fraudConfig = require('../../config/fraud.config');
const logger = require('../../core/logger');

/**
 * FRAUD DETECTION ENGINE
 * -----------------------
 * Mencegah "fake completed activity": Deal yang diselesaikan bukan hasil transaksi
 * bisnis nyata, melainkan rekayasa antara dua Party yang sebenarnya satu pihak
 * (pemilik sama), berelasi hukum (NPWP/NIB sama), berbagi dokumen identitas yang
 * sama, atau punya pola transaksi yang hanya berputar di antara mereka berdua.
 *
 * Setiap check mengembalikan `null` (aman) atau sebuah finding:
 *   { reasonCode, severity, detail }
 * `runFraudChecks()` menjalankan semua check, mengagregasi jadi satu FraudFlag
 * (kalau ada temuan), dan memutuskan apakah transisi Deal ke COMPLETED harus
 * diblokir (lihat fraud.config.js: blockThreshold).
 */

// ---------- Individual checks ----------

/** Dua Party dengan owner (Profile) yang sama = jelas self-dealing. */
function checkSameOwner(partyA, partyB) {
  if (partyA.ownerId && partyA.ownerId === partyB.ownerId) {
    return {
      reasonCode: 'SAME_OWNER',
      severity: 'CRITICAL',
      detail: `Party "${partyA.name}" dan "${partyB.name}" dimiliki oleh profile yang sama (${partyA.ownerId}).`,
    };
  }
  return null;
}

/** NPWP atau NIB yang sama dipakai di dua Party berbeda = kemungkinan besar satu entitas hukum. */
function checkSharedLegalIdentity(partyA, partyB) {
  if (partyA.npwp && partyB.npwp && partyA.npwp === partyB.npwp) {
    return {
      reasonCode: 'SHARED_LEGAL_ID',
      severity: 'CRITICAL',
      detail: `Party "${partyA.name}" dan "${partyB.name}" memakai NPWP yang sama.`,
    };
  }
  if (partyA.nib && partyB.nib && partyA.nib === partyB.nib) {
    return {
      reasonCode: 'SHARED_LEGAL_ID',
      severity: 'CRITICAL',
      detail: `Party "${partyA.name}" dan "${partyB.name}" memakai NIB yang sama.`,
    };
  }
  return null;
}

/** Dokumen verifikasi (file yang sama persis via hash) dipakai di dua Party berbeda. */
async function checkSharedDocumentHash(partyAId, partyBId) {
  const docsA = await prisma.verificationDocument.findMany({
    where: { partyId: partyAId, fileHash: { not: null } },
    select: { fileHash: true },
  });
  if (docsA.length === 0) return null;

  const hashesA = docsA.map((d) => d.fileHash);
  const overlap = await prisma.verificationDocument.findFirst({
    where: { partyId: partyBId, fileHash: { in: hashesA } },
  });

  if (overlap) {
    return {
      reasonCode: 'SHARED_DOCUMENT',
      severity: 'HIGH',
      detail: `Party ${partyAId} dan ${partyBId} punya dokumen verifikasi dengan hash file yang identik.`,
    };
  }
  return null;
}

/**
 * Kalau porsi deal COMPLETED sebuah Party yang mayoritas/seluruhnya hanya
 * dengan satu counterparty yang sama, itu pola "ping-pong" khas fake activity.
 */
async function checkDealConcentration(partyAId, partyBId) {
  const dealsOfA = await prisma.deal.findMany({
    where: {
      status: 'COMPLETED',
      invitation: { OR: [{ fromPartyId: partyAId }, { toPartyId: partyAId }] },
    },
    include: { invitation: { select: { fromPartyId: true, toPartyId: true } } },
  });

  const { minCompletedDealsToCheck, highRatio, mediumRatio } = fraudConfig.concentration;
  if (dealsOfA.length < minCompletedDealsToCheck) return null;

  const withB = dealsOfA.filter(
    (d) => d.invitation.fromPartyId === partyBId || d.invitation.toPartyId === partyBId
  ).length;
  const ratio = withB / dealsOfA.length;

  if (ratio >= highRatio) {
    return {
      reasonCode: 'HIGH_DEAL_CONCENTRATION',
      severity: 'HIGH',
      detail: `${Math.round(ratio * 100)}% dari ${dealsOfA.length} deal COMPLETED Party ${partyAId} adalah dengan Party ${partyBId} yang sama.`,
    };
  }
  if (ratio >= mediumRatio) {
    return {
      reasonCode: 'HIGH_DEAL_CONCENTRATION',
      severity: 'MEDIUM',
      detail: `${Math.round(ratio * 100)}% dari ${dealsOfA.length} deal COMPLETED Party ${partyAId} adalah dengan Party ${partyBId} yang sama.`,
    };
  }
  return null;
}

/** Deal yang pindah DEAL -> COMPLETED terlalu cepat (indikasi tidak ada pekerjaan nyata). */
function checkCompletionVelocity(deal) {
  if (!deal.startAt) return null;
  const hours = (Date.now() - new Date(deal.startAt).getTime()) / (1000 * 60 * 60);
  if (hours >= 0 && hours < fraudConfig.velocity.suspiciousUnderHours) {
    return {
      reasonCode: 'SUSPICIOUSLY_FAST_COMPLETION',
      severity: 'LOW', // sinyal lemah sendirian; berbobot saat digabung check lain
      detail: `Deal berpindah dari IN_PROGRESS ke COMPLETED hanya dalam ${hours.toFixed(2)} jam.`,
    };
  }
  return null;
}

/** Cek cache hubungan yang sudah pernah terdeteksi/ditandai admin sebelumnya. */
async function checkKnownRelationship(partyAId, partyBId) {
  const rel = await prisma.partyRelationship.findFirst({
    where: {
      OR: [
        { partyAId, partyBId },
        { partyAId: partyBId, partyBId: partyAId },
      ],
      type: { in: ['DECLARED_AFFILIATE', 'SUSPECTED_COLLUSION'] },
    },
  });
  if (!rel) return null;

  return {
    reasonCode: rel.type,
    severity: rel.confidence >= 0.8 ? 'HIGH' : 'MEDIUM',
    detail: rel.note || `Hubungan ${rel.type} sudah tercatat sebelumnya antara kedua party.`,
  };
}

// ---------- Aggregator ----------

async function upsertRelationshipCache(partyAId, partyBId, type, note) {
  try {
    await prisma.partyRelationship.upsert({
      where: { partyAId_partyBId_type: { partyAId, partyBId, type } },
      update: {},
      create: { partyAId, partyBId, type, note, confidence: 1 },
    });
  } catch (err) {
    logger.warn('Failed to cache party relationship', { error: err.message });
  }
}

/**
 * Menjalankan semua check untuk sepasang Party (dan Deal terkait jika ada),
 * lalu membuat SATU FraudFlag agregat kalau ada temuan.
 *
 * @param {object} params
 * @param {object} params.partyA - full Party record (perlu ownerId, npwp, nib, name)
 * @param {object} params.partyB
 * @param {object} [params.deal] - Deal record (untuk completion velocity check)
 * @param {string} [params.dealId]
 * @param {string} [params.invitationId]
 * @returns {Promise<{ blocked: boolean, riskScore: number, findings: object[], flagId: string|null }>}
 */
async function runFraudChecks({ partyA, partyB, deal, dealId, invitationId }) {
  const findings = [];

  const sameOwner = checkSameOwner(partyA, partyB);
  if (sameOwner) findings.push(sameOwner);

  const sharedLegal = checkSharedLegalIdentity(partyA, partyB);
  if (sharedLegal) findings.push(sharedLegal);

  const [sharedDoc, concentration, knownRel] = await Promise.all([
    checkSharedDocumentHash(partyA.id, partyB.id),
    checkDealConcentration(partyA.id, partyB.id),
    checkKnownRelationship(partyA.id, partyB.id),
  ]);
  if (sharedDoc) findings.push(sharedDoc);
  if (concentration) findings.push(concentration);
  if (knownRel) findings.push(knownRel);

  if (deal) {
    const velocity = checkCompletionVelocity(deal);
    if (velocity) findings.push(velocity);
  }

  if (findings.length === 0) {
    return { blocked: false, riskScore: 0, findings: [], flagId: null };
  }

  const riskScore = findings.reduce((sum, f) => sum + fraudConfig.severityWeight[f.severity], 0);
  const worstSeverity = findings.reduce(
    (worst, f) =>
      fraudConfig.severityWeight[f.severity] > fraudConfig.severityWeight[worst] ? f.severity : worst,
    'LOW'
  );
  const blocked = riskScore >= fraudConfig.blockThreshold;

  const flag = await prisma.fraudFlag.create({
    data: {
      dealId,
      invitationId,
      partyAId: partyA.id,
      partyBId: partyB.id,
      severity: worstSeverity,
      reasonCode: findings.map((f) => f.reasonCode).join(','),
      details: findings,
      riskScore,
      status: 'PENDING_REVIEW',
    },
  });

  // Cache the strongest structural findings so future checks (and matching
  // exclusion) are fast without re-querying documents/deal history every time.
  if (sameOwner) await upsertRelationshipCache(partyA.id, partyB.id, 'SAME_OWNER', sameOwner.detail);
  if (sharedLegal) await upsertRelationshipCache(partyA.id, partyB.id, 'SHARED_LEGAL_ID', sharedLegal.detail);
  if (sharedDoc) await upsertRelationshipCache(partyA.id, partyB.id, 'SHARED_DOCUMENT', sharedDoc.detail);

  logger.warn('Fraud check triggered findings', {
    partyA: partyA.id,
    partyB: partyB.id,
    riskScore,
    blocked,
    reasonCodes: findings.map((f) => f.reasonCode),
  });

  return { blocked, riskScore, findings, flagId: flag.id };
}

module.exports = {
  runFraudChecks,
  checkSameOwner,
  checkSharedLegalIdentity,
  checkSharedDocumentHash,
  checkDealConcentration,
  checkCompletionVelocity,
  checkKnownRelationship,
};
