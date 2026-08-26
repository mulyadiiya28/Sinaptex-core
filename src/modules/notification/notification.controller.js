const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { profileId: req.profile.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return success(res, notifications);
});

const markAsRead = asyncHandler(async (req, res) => {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.profileId !== req.profile.id) throw ApiError.notFound('Notification not found');

  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { isRead: true },
  });
  return success(res, updated);
});

module.exports = { listMyNotifications, markAsRead };
