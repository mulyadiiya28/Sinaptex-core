const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { recomputePartyStats } = require('../ranking/partyStats.service');
const { eventBus, EVENTS } = require('../../core/eventBus');

const createReview = asyncHandler(async (req, res) => {
  const { revieweeId, rating, comment } = req.body;

  const deal = await prisma.deal.findUnique({
    where: { id: req.params.dealId },
    include: { invitation: { include: { fromParty: true, toParty: true } } },
  });
  if (!deal) throw ApiError.notFound('Deal not found');
  if (deal.status !== 'COMPLETED') throw ApiError.conflict('Can only review a COMPLETED deal');

  const ownerIds = [deal.invitation.fromParty.ownerId, deal.invitation.toParty.ownerId];
  if (!ownerIds.includes(req.profile.id)) throw ApiError.forbidden('Not part of this deal');
  if (!ownerIds.includes(revieweeId) || revieweeId === req.profile.id) {
    throw ApiError.badRequest('revieweeId must be the other party in this deal');
  }

  const review = await prisma.review.create({
    data: { dealId: deal.id, reviewerId: req.profile.id, revieweeId, rating, comment },
  });

  const revieweeParty =
    deal.invitation.fromParty.ownerId === revieweeId ? deal.invitation.fromPartyId : deal.invitation.toPartyId;
  await recomputePartyStats(revieweeParty);

  eventBus.emit(EVENTS.REVIEW_CREATED, {
    reviewId: review.id,
    dealId: deal.id,
    reviewerId: req.profile.id,
    revieweeId,
    rating,
  });

  return created(res, review, 'Review submitted');
});

const listPartyReviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: req.params.profileId, hidden: false },
    include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, reviews);
});

module.exports = { createReview, listPartyReviews };
