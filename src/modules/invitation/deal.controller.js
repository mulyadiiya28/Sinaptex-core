const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { recomputePartyStats } = require('../ranking/partyStats.service');
const { eventBus, EVENTS } = require('../../core/eventBus');
const { runFraudChecks } = require('../fraud/fraud.service');
const logger = require('../../core/logger');

// Allowed forward transitions for the Deal state machine
const TRANSITIONS = {
  NEGOTIATION: ['DEAL', 'CANCELLED', 'EXPIRED'],
  DEAL: ['IN_PROGRESS', 'CANCELLED', 'EXPIRED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const listMyDeals = asyncHandler(async (req, res) => {
  const parties = await prisma.party.findMany({ where: { ownerId: req.profile.id }, select: { id: true } });
  const partyIds = parties.map((p) => p.id);

  const deals = await prisma.deal.findMany({
    where: {
      invitation: { OR: [{ fromPartyId: { in: partyIds } }, { toPartyId: { in: partyIds } }] },
    },
    include: { invitation: { include: { fromParty: true, toParty: true, opportunity: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return success(res, deals);
});

const updateDeal = asyncHandler(async (req, res) => {
  const { status, agreedTerms, notes, cancelReason } = req.body;

  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id },
    include: { invitation: { include: { fromParty: true, toParty: true } } },
  });
  if (!deal) throw ApiError.notFound('Deal not found');

  const ownerIds = [deal.invitation.fromParty.ownerId, deal.invitation.toParty.ownerId];
  if (!ownerIds.includes(req.profile.id)) throw ApiError.forbidden('Not part of this deal');

  if (!TRANSITIONS[deal.status].includes(status)) {
    throw ApiError.conflict(`Cannot transition deal from ${deal.status} to ${status}`);
  }

  // FRAUD DETECTION ENGINE: gerbang terakhir sebelum Deal dianggap "selesai beneran".
  // Kalau risk score terlalu tinggi (mis. kedua Party ternyata satu pemilik, atau
  // NPWP/NIB sama), transisi ke COMPLETED diblokir sampai admin meninjau FraudFlag-nya.
  let fraudResult = null;
  if (status === 'COMPLETED') {
    fraudResult = await runFraudChecks({
      partyA: deal.invitation.fromParty,
      partyB: deal.invitation.toParty,
      deal,
      dealId: deal.id,
      invitationId: deal.invitationId,
    });
    if (fraudResult.blocked) {
      throw ApiError.conflict(
        'Deal tidak bisa diselesaikan: terdeteksi indikasi aktivitas tidak wajar antara kedua party. ' +
          'Menunggu peninjauan admin (lihat FraudFlag).',
        { riskScore: fraudResult.riskScore, findings: fraudResult.findings },
        ErrorCodes.FRAUD_DETECTED
      );
    }
  }

  const data = {
    status,
    notes: notes ?? deal.notes,
    agreedTerms: agreedTerms ?? deal.agreedTerms,
  };
  if (status === 'IN_PROGRESS' && !deal.startAt) data.startAt = new Date();
  if (status === 'COMPLETED') data.endAt = new Date();
  if (status === 'CANCELLED') data.cancelReason = cancelReason;

  const updated = await prisma.deal.update({ where: { id: deal.id }, data });

  if (fraudResult?.findings.length) {
    logger.warn('Deal completed with non-blocking fraud findings, flagged for review', {
      dealId: deal.id,
      riskScore: fraudResult.riskScore,
      flagId: fraudResult.flagId,
    });
  }

  // Completion/cancellation feeds back into the Ranking Engine's party stats
  if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(status)) {
    await recomputePartyStats(deal.invitation.toPartyId);
    await recomputePartyStats(deal.invitation.fromPartyId);
  }

  await prisma.notification.create({
    data: {
      profileId: ownerIds.find((id) => id !== req.profile.id),
      type: 'DEAL_STATUS_CHANGED',
      title: 'Status deal diperbarui',
      message: `Deal sekarang berstatus ${status}.`,
      data: { dealId: deal.id, status },
    },
  });

  eventBus.emit(EVENTS.DEAL_STATUS_CHANGED, { dealId: deal.id, status, invitationId: deal.invitationId });

  return success(res, updated, 'Deal updated');
});

module.exports = { listMyDeals, updateDeal };
