const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const throttleConfig = require('../../config/throttle.config');

/**
 * Buat laporan user. Anti-spam:
 * - tidak boleh report diri sendiri
 * - max 1 laporan PENDING ke target yang sama dalam 24 jam
 */
const createReport = asyncHandler(async (req, res) => {
  const { reportedId, reason, description } = req.body;
  const reporterId = req.profile.id;

  if (reportedId === reporterId) {
    throw ApiError.badRequest(
      'Tidak bisa melaporkan diri sendiri',
      null,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  const reportedProfile = await prisma.profile.findUnique({ where: { id: reportedId } });
  if (!reportedProfile) throw ApiError.notFound('Reported profile not found');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingPending = await prisma.userReport.count({
    where: {
      reporterId,
      reportedId,
      status: 'PENDING',
      createdAt: { gte: since },
    },
  });

  const maxSame = throttleConfig.report.maxPendingSameTargetPerDay || 1;
  if (existingPending >= maxSame) {
    throw ApiError.conflict(
      'Anda sudah memiliki laporan aktif untuk pengguna ini. Tunggu tinjauan admin.',
      { reportedId },
      ErrorCodes.CONFLICT
    );
  }

  const report = await prisma.userReport.create({
    data: { reporterId, reportedId, reason, description },
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
