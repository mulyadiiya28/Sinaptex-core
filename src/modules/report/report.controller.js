const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createReport = asyncHandler(async (req, res) => {
  const { reportedId, reason, description } = req.body;

  if (reportedId === req.profile.id) {
    throw ApiError.badRequest('Tidak bisa melaporkan diri sendiri', null, ErrorCodes.VALIDATION_ERROR);
  }

  const reportedProfile = await prisma.profile.findUnique({ where: { id: reportedId } });
  if (!reportedProfile) throw ApiError.notFound('Reported profile not found');

  const report = await prisma.userReport.create({
    data: { reporterId: req.profile.id, reportedId, reason, description },
  });

  return created(res, report, 'Laporan diterima, akan ditinjau admin');
});

const listMyReports = asyncHandler(async (req, res) => {
  const reports = await prisma.userReport.findMany({
    where: { reporterId: req.profile.id },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, reports);
});

module.exports = { createReport, listMyReports };
