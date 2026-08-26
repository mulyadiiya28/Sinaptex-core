const crypto = require('crypto');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const { recomputeAggregateStatus } = require('./verification.service');
const { eventBus, EVENTS } = require('../../core/eventBus');
const logger = require('../../core/logger');

// STEP 2: Verification Engine - upload KTP / NIB / NPWP / Sertifikat / Lainnya
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('File is required (field name: "file")');

  const { type, partyId } = req.body;

  if (partyId) {
    const party = await prisma.party.findFirst({ where: { id: partyId, ownerId: req.profile.id } });
    if (!party) throw ApiError.forbidden('You do not own this party');
  }

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const uploaded = await uploadBuffer(req.file.buffer, {
    folder: `verification/${partyId ? 'party' : 'profile'}`,
    resourceType,
  });

  const doc = await prisma.verificationDocument.create({
    data: {
      type,
      fileUrl: uploaded.url,
      cloudinaryId: uploaded.cloudinaryId,
      fileHash,
      status: 'PENDING',
      profileId: partyId ? undefined : req.profile.id,
      partyId: partyId || undefined,
    },
  });

  // FRAUD DETECTION signal: same file uploaded before under a *different* party.
  // Not blocked here (a legit user might genuinely re-upload the same KTP for
  // a second business role) — just logged so the deal-completion fraud check
  // (fraud.service.js -> checkSharedDocumentHash) picks it up later.
  if (partyId) {
    const duplicate = await prisma.verificationDocument.findFirst({
      where: { fileHash, partyId: { not: partyId }, AND: [{ partyId: { not: null } }] },
      select: { partyId: true },
    });
    if (duplicate) {
      logger.warn('Duplicate verification document hash across different parties', {
        partyId,
        otherPartyId: duplicate.partyId,
      });
    }
  }

  await recomputeAggregateStatus({ profileId: partyId ? undefined : req.profile.id, partyId });

  return created(res, doc, 'Document uploaded, pending review');
});

const listMyDocuments = asyncHandler(async (req, res) => {
  const docs = await prisma.verificationDocument.findMany({
    where: { OR: [{ profileId: req.profile.id }, { party: { ownerId: req.profile.id } }] },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, docs);
});

// Admin action: approve/reject a document. Requires ADMIN business role.
const reviewDocument = asyncHandler(async (req, res) => {
  const { status, rejectReason } = req.body;
  const doc = await prisma.verificationDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw ApiError.notFound('Document not found');

  const updated = await prisma.verificationDocument.update({
    where: { id: doc.id },
    data: {
      status,
      rejectReason: status === 'REJECTED' ? rejectReason : null,
      reviewedBy: req.profile.id,
      reviewedAt: new Date(),
    },
  });

  await recomputeAggregateStatus({ profileId: doc.profileId, partyId: doc.partyId });

  eventBus.emit(EVENTS.VERIFICATION_REVIEWED, {
    documentId: doc.id,
    status,
    profileId: doc.profileId,
    partyId: doc.partyId,
  });

  return success(res, updated, 'Document reviewed');
});

module.exports = { uploadDocument, listMyDocuments, reviewDocument };
