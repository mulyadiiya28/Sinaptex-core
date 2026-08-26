const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { eventBus, EVENTS } = require('../../core/eventBus');

async function notify(profileId, { type, title, message, data }) {
  return prisma.notification.create({ data: { profileId, type, title, message, data } });
}

/**
 * STEP 8: Invitation Engine
 * Creates a PENDING Invitation from a persisted Match (produced by the matching engine),
 * snapshotting the score/breakdown at invite time, and notifies the receiving party's owner.
 */
const createInvitation = asyncHandler(async (req, res) => {
  const { matchId, message } = req.body;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      need: { include: { party: true } },
      offer: { include: { party: true } },
      invitation: true,
    },
  });
  if (!match) throw ApiError.notFound('Match not found. Run the matching engine first.');
  if (match.invitation) throw ApiError.conflict('An invitation already exists for this match');

  // The caller must own one side of the match; the invitation goes to the other side.
  const callerOwnsNeed = match.need.party.ownerId === req.profile.id;
  const callerOwnsOffer = match.offer.party.ownerId === req.profile.id;
  if (!callerOwnsNeed && !callerOwnsOffer) throw ApiError.forbidden('You are not part of this match');

  const fromParty = callerOwnsNeed ? match.need.party : match.offer.party;
  const toParty = callerOwnsNeed ? match.offer.party : match.need.party;
  const targetOpportunity = callerOwnsNeed ? match.offer : match.need;

  const invitation = await prisma.invitation.create({
    data: {
      matchId: match.id,
      opportunityId: targetOpportunity.id,
      fromPartyId: fromParty.id,
      toPartyId: toParty.id,
      status: 'PENDING',
      matchScore: match.finalScore ?? match.matchScore,
      breakdown: match.breakdown,
      message,
    },
  });

  await notify(toParty.ownerId, {
    type: 'INVITATION_RECEIVED',
    title: 'Undangan bisnis baru',
    message: `${fromParty.name} tertarik untuk berkolaborasi (match score: ${invitation.matchScore}).`,
    data: { invitationId: invitation.id },
  });

  return created(res, invitation, 'Invitation sent');
});

const listMyInvitations = asyncHandler(async (req, res) => {
  const parties = await prisma.party.findMany({ where: { ownerId: req.profile.id }, select: { id: true } });
  const partyIds = parties.map((p) => p.id);

  const invitations = await prisma.invitation.findMany({
    where: { OR: [{ fromPartyId: { in: partyIds } }, { toPartyId: { in: partyIds } }] },
    include: { fromParty: true, toParty: true, opportunity: true, deal: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, invitations);
});

/**
 * Receiving party ACCEPTs -> contact info unlocked + a Deal is opened in NEGOTIATION.
 * Receiving party REJECTs -> invitation closed, no Deal created.
 */
const respondInvitation = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.id },
    include: { toParty: true, fromParty: true },
  });
  if (!invitation) throw ApiError.notFound('Invitation not found');
  if (invitation.toParty.ownerId !== req.profile.id) throw ApiError.forbidden('Not the recipient');
  if (invitation.status !== 'PENDING') throw ApiError.conflict(`Invitation already ${invitation.status}`);

  const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.invitation.update({
      where: { id: invitation.id },
      data: { status, respondedAt: new Date() },
    });

    let deal = null;
    if (status === 'ACCEPTED') {
      deal = await tx.deal.create({
        data: { invitationId: invitation.id, status: 'NEGOTIATION' },
      });
    }
    return { updated, deal };
  });

  await notify(invitation.fromParty.ownerId, {
    type: status === 'ACCEPTED' ? 'INVITATION_ACCEPTED' : 'INVITATION_REJECTED',
    title: status === 'ACCEPTED' ? 'Undangan diterima!' : 'Undangan ditolak',
    message:
      status === 'ACCEPTED'
        ? `${invitation.toParty.name} menerima undangan Anda. Kontak sudah terbuka, lanjut negosiasi.`
        : `${invitation.toParty.name} menolak undangan Anda.`,
    data: { invitationId: invitation.id, dealId: result.deal?.id },
  });

  eventBus.emit(status === 'ACCEPTED' ? EVENTS.INVITATION_ACCEPTED : EVENTS.INVITATION_REJECTED, {
    invitationId: invitation.id,
    dealId: result.deal?.id,
    fromPartyId: invitation.fromPartyId,
    toPartyId: invitation.toPartyId,
  });

  // Contact info is only exposed to the two parties involved, and only post-acceptance.
  const contact =
    status === 'ACCEPTED'
      ? {
          fromParty: { name: invitation.fromParty.name, location: invitation.fromParty.location },
          toParty: { name: invitation.toParty.name, location: invitation.toParty.location },
        }
      : null;

  return success(res, { invitation: result.updated, deal: result.deal, contact }, `Invitation ${status.toLowerCase()}`);
});

module.exports = { createInvitation, listMyInvitations, respondInvitation };
