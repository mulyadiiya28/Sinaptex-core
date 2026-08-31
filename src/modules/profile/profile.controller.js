const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { uploadBuffer } = require('../../utils/cloudinaryUpload');
const { getMyFullProfile, calculateProfileProgress } = require('./profile.service');

const getMe = asyncHandler(async (req, res) => {
  const profile = await getMyFullProfile(req.profile.id);
  if (!profile) throw ApiError.notFound('Profile not found');
  return success(res, profile);
});

const getMyProgress = asyncHandler(async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.profile.id },
    include: {
      parties: { include: { capabilities: true, verifications: true } },
      verifications: true,
    },
  });
  if (!profile) throw ApiError.notFound('Profile not found');

  const progress = calculateProfileProgress(profile);
  return success(res, progress, 'Profile progress calculated');
});

const getById = asyncHandler(async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
    include: {
      businessRoles: true,
      parties: {
        include: {
          category: true,
          capabilities: { include: { capability: true } },
        },
      },
      media: {
        where: { ownerType: 'PROFILE' },
        orderBy: { createdAt: 'desc' },
      },
      reviewsReceived: {
        where: { hidden: false },
        include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!profile) throw ApiError.notFound('Profile not found');
  return success(res, profile);
});

const updateMe = asyncHandler(async (req, res) => {
  const updated = await prisma.profile.update({
    where: { id: req.profile.id },
    data: req.body,
    include: {
      parties: { include: { capabilities: true, verifications: true } },
      verifications: true,
    },
  });

  const progress = calculateProfileProgress(updated);

  return success(
    res,
    {
      ...updated,
      progress,
    },
    'Profile updated'
  );
});

const uploadPortfolioMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('File is required (field name: "file")');

  const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const uploaded = await uploadBuffer(req.file.buffer, {
    folder: 'portfolio',
    resourceType,
  });

  const media = await prisma.media.create({
    data: {
      ownerType: 'PROFILE',
      profileId: req.profile.id,
      url: uploaded.url,
      cloudinaryId: uploaded.cloudinaryId,
      format: uploaded.format || req.file.mimetype,
    },
  });

  return created(res, media, 'Portfolio media uploaded');
});

const deletePortfolioMedia = asyncHandler(async (req, res) => {
  const media = await prisma.media.findUnique({
    where: { id: req.params.mediaId },
  });

  if (!media) throw ApiError.notFound('Media item not found');
  if (media.profileId !== req.profile.id || media.ownerType !== 'PROFILE') {
    throw ApiError.forbidden('You do not own this media item');
  }

  await prisma.media.delete({
    where: { id: media.id },
  });

  return success(res, { id: media.id }, 'Portfolio media deleted');
});

module.exports = {
  getMe,
  getMyProgress,
  getById,
  updateMe,
  uploadPortfolioMedia,
  deletePortfolioMedia,
};
