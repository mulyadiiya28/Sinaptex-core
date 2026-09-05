/**
 * @openapi
 * tags:
 *   name: Chat
 *   description: |
 *     Chat MVP — conversation, messages, report peer (FR-16). REST di sini adalah
 *     pelengkap (histori, mulai conversation, upload gambar). Realtime send/receive
 *     pesan pakai Socket.IO — lihat `docs/api/websocket.md`.
 *
 * /chat/conversations:
 *   post:
 *     tags: [Chat]
 *     summary: Mulai atau ambil conversation yang sudah ada dengan seorang profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientProfileId]
 *             properties:
 *               recipientProfileId: { type: string, format: uuid }
 *               originType: { type: string, enum: [PROFILE, NEED, OFFER], default: PROFILE }
 *               opportunityId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Conversation sudah ada sebelumnya, dikembalikan apa adanya }
 *       201: { description: Conversation baru dibuat }
 *       400: { description: Validasi gagal }
 *       403: { description: Diblokir kebijakan chat NEED/OFFER, atau rate limit conv/hari terlampaui }
 *   get:
 *     tags: [Chat]
 *     summary: List conversation milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar conversation terurut aktivitas terbaru }
 *
 * /chat/conversations/{id}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: Riwayat pesan dalam satu conversation (pagination)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar pesan dengan meta pagination }
 *       403: { description: Bukan partisipan conversation ini }
 *       404: { description: Conversation tidak ditemukan }
 *   post:
 *     tags: [Chat]
 *     summary: Kirim pesan lewat REST (fallback bila client tidak pakai Socket.IO, atau upload image/attachment)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [TEXT, IMAGE, ATTACHMENT] }
 *               content: { type: string, maxLength: 5000 }
 *               file: { type: string, format: binary, description: Wajib bila type IMAGE/ATTACHMENT }
 *     responses:
 *       201: { description: Pesan terkirim; juga di-broadcast via Socket.IO ke partisipan lain }
 *       403: { description: Bukan partisipan conversation ini, atau diblokir anti-spam (unreplied burst) }
 *       404: { description: Conversation tidak ditemukan }
 *
 * /chat/conversations/{id}/read:
 *   patch:
 *     tags: [Chat]
 *     summary: Tandai conversation sudah dibaca (reset unread counter)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Conversation ditandai dibaca }
 *       403: { description: Bukan partisipan conversation ini }
 *       404: { description: Conversation tidak ditemukan }
 *
 * /chat/conversations/{id}/report:
 *   post:
 *     tags: [Chat]
 *     summary: Laporkan lawan bicara dalam conversation (spam, penipuan, dst)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, enum: [SPAM, PENIPUAN, KONTEN_TIDAK_PANTAS, PELECEHAN, LAINNYA] }
 *               description: { type: string, maxLength: 1000 }
 *     responses:
 *       201: { description: Laporan dibuat, masuk antrean review admin }
 *       403: { description: Bukan partisipan conversation ini }
 *       429: { description: Rate limit laporan terlampaui }
 */
const router = require('express').Router();
const {
  startConversation,
  listConversations,
  getMessages,
  sendMessage,
  markAsRead,
  reportConversationPeer,
} = require('./chat.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const { reportLimiter } = require('../../middlewares/rateLimit.middleware');
const {
  startConversationSchema,
  idParamSchema,
  getMessagesSchema,
  sendMessageSchema,
  reportPeerSchema,
} = require('../../validations/chat.validation');

router.use(requireAuth);

router.post('/conversations', validate(startConversationSchema), startConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', validate(getMessagesSchema), getMessages);
router.post(
  '/conversations/:id/messages',
  upload.single('file'),
  validate(sendMessageSchema),
  sendMessage
);
router.patch('/conversations/:id/read', validate(idParamSchema), markAsRead);
router.post(
  '/conversations/:id/report',
  reportLimiter,
  validate(reportPeerSchema),
  reportConversationPeer
);

module.exports = router;
