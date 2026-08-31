/**
 * @openapi
 * tags:
 *   name: Chat
 *   description: Chat MVP — conversation, messages, report peer (FR-16)
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
