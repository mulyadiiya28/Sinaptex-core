/**
 * @openapi
 * tags:
 *   name: Chat
 *   description: |
 *     Chat (MVP Phase 8). Pesan TEXT sebaiknya lewat WebSocket (real-time,
 *     lihat src/core/socket.js) — endpoint REST di sini terutama untuk
 *     manajemen conversation, riwayat pesan (pagination), dan upload
 *     IMAGE/ATTACHMENT (perlu multipart, tidak praktis lewat WS).
 *
 * /chat/conversations:
 *   post:
 *     tags: [Chat]
 *     summary: Mulai/ambil conversation dengan seseorang. Conversation BARU wajib recipient member aktif.
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Chat]
 *     summary: List semua conversation saya, dengan preview pesan terakhir & status unread
 *     security: [{ bearerAuth: [] }]
 *
 * /chat/conversations/{id}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: Riwayat pesan (pagination)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Chat]
 *     summary: Kirim pesan (REST fallback; TEXT lewat WS lebih real-time). Multipart untuk IMAGE/ATTACHMENT.
 *     security: [{ bearerAuth: [] }]
 *
 * /chat/conversations/{id}/read:
 *   patch:
 *     tags: [Chat]
 *     summary: Tandai conversation sudah dibaca sampai saat ini
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const {
  startConversation,
  listConversations,
  getMessages,
  sendMessage,
  markAsRead,
} = require('./chat.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const {
  startConversationSchema,
  idParamSchema,
  getMessagesSchema,
  sendMessageSchema,
} = require('../../validations/chat.validation');

router.use(requireAuth); // seluruh Chat module butuh login

router.post('/conversations', validate(startConversationSchema), startConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', validate(getMessagesSchema), getMessages);
router.post(
  '/conversations/:id/messages',
  upload.single('file'), // opsional — hanya wajib untuk type IMAGE/ATTACHMENT
  validate(sendMessageSchema),
  sendMessage
);
router.patch('/conversations/:id/read', validate(idParamSchema), markAsRead);

module.exports = router;
