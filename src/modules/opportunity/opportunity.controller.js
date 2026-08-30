const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const { toSkipTake, buildMeta } = require('../../shared/pagination');
const { MAX_ACTIVE_OFFERS } = require('../../shared/constants');
const membershipService = require('../membership/membership.service');

const includeDefault = {
  category: true,
  capabilities: { include: { capability: true } },
  media: true,
  boost: { include: { plan: true } },
  party: { select: { id: true, name: true, verificationStatus: true, logoUrl: true } },
};

/** Hitung Offer ACTIVE milik Profile (lintas semua Party-nya). */
async function countActiveOffers(profileId, { excludeOpportunityId } = {}) {
  return prisma.opportunity.count({
    where: {
      type: 'OFFER',
      status: 'ACTIVE',
      party: { ownerId: profileId },
      ...(excludeOpportunityId && { id: { not: excludeOpportunityId } }),
    },
  });
}

async function assertOfferQuota(profileId, { excludeOpportunityId } = {}) {
  const count = await countActiveOffers(profileId, { excludeOpportunityId });
  if (count >= MAX_ACTIVE_OFFERS) {
    throw ApiError.forbidden(
      `Kuota Offer aktif maksimal ${MAX_ACTIVE_OFFERS}. Tutup atau nonaktifkan Offer lain dulu.`,
      ErrorCodes.OFFER_QUOTA_EXCEEDED
    );
  }
}

// STEP 3: Create Opportunity (NEED or OFFER)
// Need selalu gratis. Offer: membership aktif + kuota max MAX_ACTIVE_OFFERS (FR-15).
const createOpportunity = asyncHandler(async (req, res) => {
  const { partyId, capabilityNames, ...data } = req.body;

  const party = await prisma.party.findFirst({
    where: { id: partyId, ownerId: req.profile.id },
  });
  if (!party) throw ApiError.forbidden('You do not own this party');

  if (data.type === 'OFFER') {
    const active = await membershipService.hasActiveMembership(req.profile.id);
    if (!active) {
      throw ApiError.forbidden(
        'Membuat Offer butuh membership aktif. Need tetap gratis tanpa batasan ini.',
        ErrorCodes.MEMBERSHIP_REQUIRED
      );
    }
    // Default status Opportunity = ACTIVE — kuota berlaku untuk create.
    await assertOfferQuota(req.profile.id);
  }

  const opportunity = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.create({ data: { ...data, partyId } });

    if (capabilityNames?.length) {
      await Promise.all(
        capabilityNames.map(async (name) => {
          const capability = await tx.capability.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          await tx.opportunityCapability.create({
            data: { opportunityId: opp.id, capabilityId: capability.id },
          });
        })
      );
    }

    return tx.opportunity.findUnique({ where: { id: opp.id }, include: includeDefault });
  });

  return created(res, opportunity, 'Opportunity created');
});

const listOpportunities = asyncHandler(async (req, res) => {
  const {
    type,
    categoryId,
    status,
    location,
    tag,
    budgetMin,
    budgetMax,
    search,
    sortBy,
    sortOrder,
    page,
    limit,
  } = req.query;

  const where = {
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    status: status || 'ACTIVE',
    visibility: 'PUBLIC',
    ...(location && { location: { contains: location, mode: 'insensitive' } }),
    ...(tag && { tags: { has: tag } }),
    ...(budgetMax !== undefined && { budgetMin: { lte: budgetMax } }),
    ...(budgetMin !== undefined && { budgetMax: { gte: budgetMin } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const orderBy = [{ boost: { priorityWeight: 'desc' } }, { [sortBy]: sortOrder }];

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: includeDefault,
      orderBy,
      ...toSkipTake({ page, limit }),
    }),
    prisma.opportunity.count({ where }),
  ]);

  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const getOpportunity = asyncHandler(async (req, res) => {
  const opp = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: includeDefault,
  });
  if (!opp) throw ApiError.notFound('Opportunity not found');
  return success(res, opp);
});

const updateOpportunity = asyncHandler(async (req, res) => {
  const existing = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: { party: true },
  });
  if (!existing) throw ApiError.notFound('Opportunity not found');
  if (existing.party.ownerId !== req.profile.id) throw ApiError.forbidden();

  // Re-aktifkan Offer (status → ACTIVE) ikut kuota + membership (FR-15).
  const becomingActive =
    req.body.status === 'ACTIVE' && existing.status !== 'ACTIVE';
  if (existing.type === 'OFFER' && becomingActive) {
    const active = await membershipService.hasActiveMembership(req.profile.id);
    if (!active) {
      throw ApiError.forbidden(
        'Mengaktifkan Offer butuh membership aktif.',
        ErrorCodes.MEMBERSHIP_REQUIRED
      );
    }
    await assertOfferQuota(req.profile.id, { excludeOpportunityId: existing.id });
  }

  const updated = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: req.body,
    include: includeDefault,
  });
  return success(res, updated, 'Opportunity updated');
});

const uploadMedia = asyncHandler(async (req, res) => {
  const opp = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: { party: true },
  });
  if (!opp) throw ApiError.notFound('Opportunity not found');
  if (opp.party.ownerId !== req.profile.id) throw ApiError.forbidden();
  if (!req.file) throw ApiError.badRequest('File is required (field name: "file")');

  const uploaded = await uploadBuffer(req.file.buffer, {
    folder: 'opportunity-media',
    resourceType: 'image',
  });

  const media = await prisma.media.create({
    data: {
      ownerType: 'OPPORTUNITY',
      opportunityId: opp.id,
      url: uploaded.url,
      cloudinaryId: uploaded.cloudinaryId,
      format: uploaded.format,
    },
  });

  return created(res, media, 'Media uploaded');
});

module.exports = {
  createOpportunity,
  listOpportunities,
  getOpportunity,
  updateOpportunity,
  uploadMedia,
};
