const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getById = asyncHandler(async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
    include: {
      businessRoles: true,
      parties: { include: { capabilities: { include: { capability: true } } } },
    },
  });
  if (!profile) throw ApiError.notFound('Profile not found');
  return success(res, profile);
});

const updateMe = asyncHandler(async (req, res) => {
  const updated = await prisma.profile.update({
    where: { id: req.profile.id },
    data: req.body,
  });
  return success(res, updated, 'Profile updated');
});

module.exports = { getById, updateMe };
