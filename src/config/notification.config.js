// NOTE: hanya channel IN_APP yang aktif saat ini (lihat src/modules/notification).
// Channel lain ditandai `enabled: false` sampai Phase 10/11 diimplementasikan.

module.exports = {
  channels: {
    inApp: { enabled: true },
    email: { enabled: false, provider: null },
    push: { enabled: false, provider: null },
    sms: { enabled: false, provider: null },
    whatsapp: { enabled: false, provider: null },
    webhook: { enabled: false },
  },
  retry: {
    maxAttempts: 3,
    backoffMs: 5000,
  },
  types: {
    INVITATION_RECEIVED: 'Undangan bisnis baru diterima',
    INVITATION_ACCEPTED: 'Undangan diterima counterparty',
    INVITATION_REJECTED: 'Undangan ditolak counterparty',
    DEAL_STATUS_CHANGED: 'Status deal berubah',
  },
};
