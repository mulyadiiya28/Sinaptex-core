const { z } = require('zod');
const router = require('express').Router();
const { listMyNotifications, markAsRead } = require('./notification.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');

router.get('/me', requireAuth, listMyNotifications);
router.patch(
  '/:id/read',
  requireAuth,
  validate({ params: z.object({ id: z.string().uuid() }) }),
  markAsRead
);

module.exports = router;
