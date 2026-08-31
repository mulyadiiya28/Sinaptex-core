const crypto = require('crypto');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { uploadBuffer, deleteAsset } = require('../../utils/cloudinaryUpload');
const logger = require('../../core/logger');

/**
 * Opportunity Document & Proof of Trade Upload Service
 *
 * Facilitates attaching verified trade documentation, quality certificates,
 * bills of lading, invoices, or sample images to Needs & Offers via Cloudinary.
 */

const ALLOWED_DOCUMENT_TYPES = [
  'PROOF_OF_TRADE',
  'QUALITY_CERTIFICATE',
  'INVOICE',
  'SPECIFICATION',
  'SAMPLE_IMAGE',
  'LEGAL_COMPLIANCE',
  'OTHER',
];

/**
 * Computes SHA256 hash of a file buffer for proof verification and duplicate tracking.
 * @param {Buffer} buffer
 * @returns {string}
 */
function computeFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Uploads and attaches a proof of trade or verified document to an opportunity (Need / Offer).
 *
 * @param {object} params
 * @param {string} params.opportunityId - Target Opportunity UUID
 * @param {string} params.profileId - Authenticated profile ID
 * @param {object} params.file - Multer file object (buffer, mimetype, originalname)
 * @param {string} [params.documentType='PROOF_OF_TRADE'] - Classification of the document
 * @param {string} [params.title] - Optional document label
 * @returns {Promise<object>} Created media record with Cloudinary details
 */
async function attachDocumentToOpportunity({
  opportunityId,
  profileId,
  file,
  documentType = 'PROOF_OF_TRADE',
  title,
}) {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('File buffer is required for upload', ErrorCodes.VALIDATION_ERROR);
  }

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { party: true },
  });

  if (!opportunity) {
    throw ApiError.notFound('Opportunity not found', ErrorCodes.NOT_FOUND);
  }

  if (opportunity.party.ownerId !== profileId) {
    throw ApiError.forbidden(
      'You are not authorized to upload documentation for this opportunity',
      ErrorCodes.FORBIDDEN
    );
  }

  const fileHash = computeFileHash(file.buffer);
  const isPdf = file.mimetype === 'application/pdf';
  const resourceType = isPdf ? 'raw' : 'image';
  const folder = `sinaptex/opportunities/${opportunity.type.toLowerCase()}/${opportunityId}/proofs`;

  logger.info('Uploading trade proof document to Cloudinary', {
    opportunityId,
    opportunityType: opportunity.type,
    mimetype: file.mimetype,
    resourceType,
    fileHash: fileHash.substring(0, 10),
  });

  const uploadResult = await uploadBuffer(file.buffer, {
    folder,
    resourceType,
  });

  const media = await prisma.media.create({
    data: {
      ownerType: 'OPPORTUNITY',
      opportunityId: opportunity.id,
      url: uploadResult.url,
      cloudinaryId: uploadResult.cloudinaryId,
      format: uploadResult.format || (isPdf ? 'pdf' : 'unknown'),
    },
  });

  return {
    ...media,
    documentType,
    title: title || file.originalname || 'Verified Documentation',
    fileHash,
    opportunityType: opportunity.type,
  };
}

/**
 * Lists all verified documents/proofs attached to an opportunity.
 *
 * @param {string} opportunityId
 * @returns {Promise<Array<object>>}
 */
async function listOpportunityDocuments(opportunityId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      media: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!opportunity) {
    throw ApiError.notFound('Opportunity not found', ErrorCodes.NOT_FOUND);
  }

  return opportunity.media;
}

/**
 * Removes an attached proof document from Cloudinary and database.
 *
 * @param {object} params
 * @param {string} params.opportunityId
 * @param {string} params.mediaId
 * @param {string} params.profileId
 */
async function removeOpportunityDocument({ opportunityId, mediaId, profileId }) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { party: true },
  });

  if (!opportunity) {
    throw ApiError.notFound('Opportunity not found', ErrorCodes.NOT_FOUND);
  }

  if (opportunity.party.ownerId !== profileId) {
    throw ApiError.forbidden(
      'You are not authorized to delete documentation for this opportunity',
      ErrorCodes.FORBIDDEN
    );
  }

  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      opportunityId,
      ownerType: 'OPPORTUNITY',
    },
  });

  if (!media) {
    throw ApiError.notFound('Document not found on this opportunity', ErrorCodes.NOT_FOUND);
  }

  try {
    const resourceType = media.format === 'pdf' ? 'raw' : 'image';
    await deleteAsset(media.cloudinaryId, resourceType);
  } catch (err) {
    logger.warn('Failed to delete asset from Cloudinary, continuing DB cleanup', {
      cloudinaryId: media.cloudinaryId,
      error: err.message,
    });
  }

  await prisma.media.delete({
    where: { id: media.id },
  });

  return { deleted: true, mediaId: media.id };
}

module.exports = {
  ALLOWED_DOCUMENT_TYPES,
  computeFileHash,
  attachDocumentToOpportunity,
  listOpportunityDocuments,
  removeOpportunityDocument,
};
