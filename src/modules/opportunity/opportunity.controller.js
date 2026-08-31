const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const { toSkipTake, buildMeta } = require('../../shared/pagination');
const opportunityPolicyService = require('./opportunityPolicy.service');
const opportunityDocumentService = require('./opportunityDocument.service');

const includeDefault = {
  category: true,
  capabilities: { include: { capability: true } },
  media: true,
  boost: { include: { plan: true } },
  party: { select: { id: true, name: true, verificationStatus: true, logoUrl: true } },
};

// STEP 3: Create Opportunity (NEED or OFFER)
// Non-member: max 1 NEED, max 1 OFFER. Member: max 20 NEED, max 20 OFFER.
const createOpportunity = asyncHandler(async (req, res) => {
  const { partyId, capabilityNames, ...data } = req.body;

  const party = await prisma.party.findFirst({
    where: { id: partyId, ownerId: req.profile.id },
  });
  if (!party) throw ApiError.forbidden('You do not own this party');

  const isTargetActive = !data.status || data.status === 'ACTIVE';
  if (isTargetActive) {
    await opportunityPolicyService.enforceOpportunityQuota(req.profile.id, data.type);
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

  // Re-aktifkan Opportunity (status → ACTIVE) ikut batasan kuota membership.
  const becomingActive =
    req.body.status === 'ACTIVE' && existing.status !== 'ACTIVE';
  if (becomingActive) {
    await opportunityPolicyService.enforceOpportunityQuota(req.profile.id, existing.type, {
      excludeOpportunityId: existing.id,
    });
  }

  const updated = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: req.body,
    include: includeDefault,
  });
  return success(res, updated, 'Opportunity updated');
});

const closeOpportunity = asyncHandler(async (req, res) => {
  const opp = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: { party: true },
  });
  if (!opp) throw ApiError.notFound('Opportunity not found');
  if (opp.party.ownerId !== req.profile.id) {
    throw ApiError.forbidden('You do not own this opportunity');
  }
  if (opp.status === 'CLOSED') {
    throw ApiError.conflict('Opportunity is already closed');
  }

  const updated = await prisma.opportunity.update({
    where: { id: opp.id },
    data: { status: 'CLOSED' },
    include: includeDefault,
  });

  return success(res, updated, 'Opportunity closed successfully');
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

const uploadOpportunityDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('File is required (field name: "file")');
  }

  const result = await opportunityDocumentService.attachDocumentToOpportunity({
    opportunityId: req.params.id,
    profileId: req.profile.id,
    file: req.file,
    documentType: req.body.documentType,
    title: req.body.title,
  });

  return created(res, result, 'Verified document attached to opportunity');
});

const listOpportunityDocuments = asyncHandler(async (req, res) => {
  const documents = await opportunityDocumentService.listOpportunityDocuments(req.params.id);
  return success(res, documents, 'Documents retrieved successfully');
});

const deleteOpportunityDocument = asyncHandler(async (req, res) => {
  const result = await opportunityDocumentService.removeOpportunityDocument({
    opportunityId: req.params.id,
    mediaId: req.params.documentId,
    profileId: req.profile.id,
  });

  return success(res, result, 'Document removed from opportunity');
});

module.exports = {
  createOpportunity,
  listOpportunities,
  getOpportunity,
  updateOpportunity,
  closeOpportunity,
  uploadMedia,
  uploadOpportunityDocument,
  listOpportunityDocuments,
  deleteOpportunityDocument,
};

