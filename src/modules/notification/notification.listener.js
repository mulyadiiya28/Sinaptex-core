const prisma = require('../../config/prisma');
const { eventBus, EVENTS } = require('../../core/eventBus');
const logger = require('../../core/logger');

/**
 * Berlangganan event domain dan membuat Notification in-app. Dipanggil sekali
 * saat server start (lihat app.js) — TIDAK dipanggil manual dari service lain.
 * Susunan sesuai review: MessageSent -> Notification (di sini) -> Socket
 * (src/core/socket.js, listener terpisah) -> [Email/Push nanti, listener baru
 * lagi, tanpa ubah chat.service.js sama sekali].
 */
function registerNotificationListeners() {
  eventBus.on(EVENTS.CHAT_MESSAGE_SENT, async ({ message, recipientId }) => {
    if (!recipientId) return;
    try {
      await prisma.notification.create({
        data: {
          profileId: recipientId,
          type: 'CHAT_MESSAGE',
          title: 'Pesan baru',
          message:
            message.type === 'TEXT'
              ? message.content.slice(0, 140)
              : `Mengirim ${message.type === 'IMAGE' ? 'gambar' : 'lampiran'}`,
          data: { conversationId: message.conversationId, messageId: message.id },
        },
      });
    } catch (err) {
      logger.error('Failed to create chat notification', { error: err.message });
    }
  });

  logger.info('Notification listeners registered');
}

module.exports = { registerNotificationListeners };
