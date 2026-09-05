/**
 * @openapi
 * tags:
 *   name: Notifications
 *   description: |
 *     Notifikasi in-app. Push real-time lewat event Socket.IO `notification:new`
 *     (lihat `docs/api/websocket.md`) — endpoint REST di bawah untuk riwayat & mark-read.
 *
 * /notifications/me:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifikasi milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Daftar notifikasi dengan meta pagination }
 *       401: { description: Token tidak ada/invalid }
 *
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Tandai satu notifikasi sudah dibaca
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Notifikasi ditandai dibaca }
 *       403: { description: Bukan notifikasi milik sendiri }
 *       404: { description: Notifikasi tidak ditemukan }
 */
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
