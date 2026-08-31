const prisma = require('../../config/prisma');
const { eventBus, EVENTS } = require('../../core/eventBus');
const logger = require('../../core/logger');

/**
 * Berlangganan event domain dan membuat Notification in-app. Dipanggil sekali
 * saat server start (lihat app.js) — TIDAK dipanggil manual dari service lain.
 * Susunan: Event -> Notification (di sini) -> Socket -> [Email/Push nanti].
 */
function registerNotificationListeners() {
  // 1. Chat: Notifikasi pesan baru
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

  // 2. Review: Notifikasi ulasan baru diterima
  eventBus.on(EVENTS.REVIEW_CREATED, async ({ reviewId, revieweeId, rating }) => {
    if (!revieweeId) return;
    try {
      await prisma.notification.create({
        data: {
          profileId: revieweeId,
          type: 'REVIEW_RECEIVED',
          title: 'Ulasan baru diterima',
          message: `Anda mendapatkan ulasan baru dengan rating ${rating}/5 bintang.`,
          data: { reviewId, rating },
        },
      });
    } catch (err) {
      logger.error('Failed to create review notification', { error: err.message });
    }
  });

  // 3. Verification: Notifikasi status dokumen verifikasi
  eventBus.on(EVENTS.VERIFICATION_REVIEWED, async ({ documentId, status, profileId, partyId }) => {
    let targetProfileId = profileId;
    if (!targetProfileId && partyId) {
      try {
        const party = await prisma.party.findUnique({ where: { id: partyId }, select: { ownerId: true } });
        targetProfileId = party?.ownerId;
      } catch {
        // ignore
      }
    }
    if (!targetProfileId) return;

    try {
      const isApproved = status === 'VERIFIED';
      await prisma.notification.create({
        data: {
          profileId: targetProfileId,
          type: 'VERIFICATION_STATUS',
          title: isApproved ? 'Dokumen verifikasi disetujui' : 'Dokumen verifikasi ditolak',
          message: isApproved
            ? 'Dokumen verifikasi Anda telah berhasil diverifikasi oleh tim kurator.'
            : 'Dokumen verifikasi Anda belum dapat disetujui. Silakan periksa alasan dan unggah ulang.',
          data: { documentId, status },
        },
      });
    } catch (err) {
      logger.error('Failed to create verification notification', { error: err.message });
    }
  });

  // 4. Deal: Notifikasi perubahan status deal
  eventBus.on(EVENTS.DEAL_STATUS_CHANGED, async ({ dealId, status, recipientProfileId, dealTitle }) => {
    if (!recipientProfileId) return;
    try {
      await prisma.notification.create({
        data: {
          profileId: recipientProfileId,
          type: 'DEAL_UPDATE',
          title: 'Update status transaksi',
          message: dealTitle
            ? `Status transaksi "${dealTitle}" telah berubah menjadi ${status}.`
            : `Status transaksi telah diperbarui menjadi ${status}.`,
          data: { dealId, status },
        },
      });
    } catch (err) {
      logger.error('Failed to create deal notification', { error: err.message });
    }
  });

  logger.info('Notification listeners registered');
}

module.exports = { registerNotificationListeners };
