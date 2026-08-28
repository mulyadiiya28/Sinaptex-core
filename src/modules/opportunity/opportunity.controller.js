const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const { toSkipTake, buildMeta } = require('../../shared/pagination');
const membershipService = require('../membership/membership.service');

const includeDefault = {
  category: true,
  capabilities: { include: { capability: true } },
  media: true,
  boost: { include: { plan: true } },
  party: { select: { id: true, name: true, verificationStatus: true, logoUrl: true } },
};

// STEP 3: Create Opportunity (NEED or OFFER)
// Business rule (MVP checklist): Need selalu gratis. Offer WAJIB member aktif.
const createOpportunity = asyncHandler(async (req, res) => {
  const { partyId, capabilityNames, ...data } = req.body;

  const party = await prisma.party.findFirst({ where: { id: partyId, ownerId: req.profile.id } });
  if (!party) throw ApiError.forbidden('You do not own this party');

  if (data.type === 'OFFER') {
    const active = await membershipService.hasActiveMembership(req.profile.id);
    if (!active) {
      throw ApiError.forbidden(
        'Membuat Offer butuh membership aktif. Need tetap gratis tanpa batasan ini.',
        ErrorCodes.MEMBERSHIP_REQUIRED
      );
    }
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
    // Range overlap: opportunity's budget window must intersect the requested [budgetMin, budgetMax]
    ...(budgetMax !== undefined && { budgetMin: { lte: budgetMax } }),
    ...(budgetMin !== undefined && { budgetMax: { gte: budgetMin } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  // Boosted opportunities always surface first regardless of chosen sort, then the requested sort applies.
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
