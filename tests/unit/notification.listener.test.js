const prisma = require('../../src/config/prisma');
const { eventBus, EVENTS } = require('../../src/core/eventBus');
const { registerNotificationListeners } = require('../../src/modules/notification/notification.listener');

jest.mock('../../src/config/prisma', () => ({
  notification: {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  },
  party: {
    findUnique: jest.fn().mockResolvedValue({ ownerId: 'party-owner-123' }),
  },
}));

describe('Notification Event Listeners (MVP Phase 9)', () => {
  beforeAll(() => {
    registerNotificationListeners();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates notification when CHAT_MESSAGE_SENT is emitted', async () => {
    eventBus.emit(EVENTS.CHAT_MESSAGE_SENT, {
      message: { id: 'msg-1', conversationId: 'conv-1', type: 'TEXT', content: 'Halo, saya tertarik!' },
      recipientId: 'profile-recipient',
    });

    // Wait a tick for async eventBus handler
    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'profile-recipient',
        type: 'CHAT_MESSAGE',
        title: 'Pesan baru',
        message: 'Halo, saya tertarik!',
      }),
    });
  });

  it('creates notification when REVIEW_CREATED is emitted', async () => {
    eventBus.emit(EVENTS.REVIEW_CREATED, {
      reviewId: 'rev-1',
      revieweeId: 'profile-reviewee',
      reviewerId: 'profile-reviewer',
      rating: 5,
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'profile-reviewee',
        type: 'REVIEW_RECEIVED',
        title: 'Ulasan baru diterima',
        message: expect.stringContaining('5/5 bintang'),
      }),
    });
  });

  it('creates notification when VERIFICATION_REVIEWED is emitted', async () => {
    eventBus.emit(EVENTS.VERIFICATION_REVIEWED, {
      documentId: 'doc-1',
      status: 'VERIFIED',
      profileId: 'profile-user-1',
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'profile-user-1',
        type: 'VERIFICATION_STATUS',
        title: 'Dokumen verifikasi disetujui',
      }),
    });
  });

  it('creates notification when DEAL_STATUS_CHANGED is emitted', async () => {
    eventBus.emit(EVENTS.DEAL_STATUS_CHANGED, {
      dealId: 'deal-1',
      status: 'IN_PROGRESS',
      recipientProfileId: 'profile-partner',
      dealTitle: 'Pengadaan 100 Ton Beras Organik',
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'profile-partner',
        type: 'DEAL_UPDATE',
        title: 'Update status transaksi',
        message: expect.stringContaining('IN_PROGRESS'),
      }),
    });
  });
});
