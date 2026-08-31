const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { toSkipTake, buildMeta } = require('../../shared/pagination');
const logger = require('../../core/logger');
const adminService = require('./admin.service');
const chatRateLimitPolicy = require('../chat/chatRateLimitPolicy.service');

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  return success(res, stats);
});

const listUsers = asyncHandler(async (req, res) => {
  const { search, accountStatus, page, limit } = req.query;
  const where = {
    ...(accountStatus && { accountStatus }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      include: { user: { select: { email: true } }, businessRoles: true },
      orderBy: { id: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.profile.count({ where }),
  ]);

  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const getUser = asyncHandler(async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { email: true, createdAt: true } },
      businessRoles: true,
      parties: true,
      membership: true,
    },
  });
  if (!profile) throw ApiError.notFound('Profile not found');
  return success(res, profile);
});

const suspendUser = asyncHandler(async (req, res) => {
  const { accountStatus, reason } = req.body;
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) throw ApiError.notFound('Profile not found');

  const updated = await prisma.profile.update({
    where: { id: req.params.id },
    data: {
      accountStatus,
      suspendedReason: accountStatus === 'ACTIVE' ? null : reason,
      suspendedAt: accountStatus === 'ACTIVE' ? null : new Date(),
    },
  });
  return success(res, updated, `Account status updated to ${accountStatus}`);
});

const listOpportunitiesForModeration = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { party: { select: { id: true, name: true, ownerId: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.opportunity.count({ where }),
  ]);
  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const forceUpdateOpportunityStatus = asyncHandler(async (req, res) => {
  const { status, moderationNote } = req.body;
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) throw ApiError.notFound('Opportunity not found');

  const updated = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: { status },
  });

  if (moderationNote) {
    logger.info('Admin moderated opportunity', {
      opportunityId: req.params.id,
      status,
      moderationNote,
      adminId: req.profile.id,
    });
  }

  return success(res, updated, 'Opportunity status updated by admin');
});

const listReviewsForModeration = asyncHandler(async (req, res) => {
  const { hidden, page, limit } = req.query;
  const where = hidden !== undefined ? { hidden: hidden === 'true' } : {};

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewer: { select: { id: true, fullName: true } },
        reviewee: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.review.count({ where }),
  ]);
  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const setReviewVisibility = asyncHandler(async (req, res) => {
  const { hidden, hiddenReason } = req.body;
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) throw ApiError.notFound('Review not found');

  const updated = await prisma.review.update({
    where: { id: req.params.id },
    data: { hidden, hiddenReason: hidden ? hiddenReason : null },
  });
  return success(res, updated, hidden ? 'Review hidden' : 'Review restored');
});

const listReports = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.userReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, fullName: true } },
        reported: { select: { id: true, fullName: true, accountStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.userReport.count({ where }),
  ]);
  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const reviewReport = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const report = await prisma.userReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw ApiError.notFound('Report not found');

  const updated = await prisma.userReport.update({
    where: { id: report.id },
    data: {
      status,
      adminNote,
      reviewedBy: req.profile.id,
      reviewedAt: new Date(),
    },
  });
  return success(res, updated, 'Report reviewed');
});

const listTransactions = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.membershipTransaction.findMany({
      where,
      include: {
        plan: true,
        membership: {
          include: { profile: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.membershipTransaction.count({ where }),
  ]);
  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

/** GET /admin/settings/chat-rate-limit */
const getChatRateLimitSettings = asyncHandler(async (req, res) => {
  const policy = await chatRateLimitPolicy.getPolicy();
  return success(res, {
    policy,
    envDefaults: chatRateLimitPolicy.DEFAULTS,
  });
});

/** PATCH /admin/settings/chat-rate-limit */
const updateChatRateLimitSettings = asyncHandler(async (req, res) => {
  try {
    const updated = await chatRateLimitPolicy.updatePolicy(req.body, req.profile.id);
    logger.info('Admin updated chat rate limit policy', {
      adminId: req.profile.id,
      policy: updated,
    });
    return success(res, updated, 'Chat rate limit policy updated');
  } catch (err) {
    throw ApiError.badRequest(err.message || 'Invalid chat rate limit policy');
  }
});

module.exports = {
  getDashboard,
  listUsers,
  getUser,
  suspendUser,
  listOpportunitiesForModeration,
  forceUpdateOpportunityStatus,
  listReviewsForModeration,
  setReviewVisibility,
  listReports,
  reviewReport,
  listTransactions,
  getChatRateLimitSettings,
  updateChatRateLimitSettings,
};
