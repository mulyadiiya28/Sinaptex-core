const { EventEmitter2 } = require('eventemitter2');
const logger = require('./logger');

const eventBus = new EventEmitter2({ wildcard: true, delimiter: '.', maxListeners: 50 });

// Registry of known events emitted across the app — keeps producers/consumers in sync.
// Payload shapes documented inline; extend as new events are added.
const EVENTS = {
  INVITATION_ACCEPTED: 'invitation.accepted', // { invitationId, dealId, fromPartyId, toPartyId }
  INVITATION_REJECTED: 'invitation.rejected', // { invitationId, fromPartyId, toPartyId }
  DEAL_STATUS_CHANGED: 'deal.status_changed', // { dealId, status, invitationId }
  REVIEW_CREATED: 'review.created', // { reviewId, revieweeId, rating }
  VERIFICATION_REVIEWED: 'verification.reviewed', // { documentId, status, profileId, partyId }
  // Chat (MVP Phase 8): sendMessage()/markAsRead() di chat.service.js HANYA emit
  // event ini — TIDAK tahu-menahu soal Socket.IO atau Notification. Listener
  // terpisah (src/core/socket.js untuk broadcast real-time,
  // src/modules/notification/notification.listener.js untuk in-app notification)
  // berlangganan event ini sendiri-sendiri. Susunan: MessageSent -> Notification
  // -> Socket (nanti bisa nambah -> Email -> Push tanpa ubah chat.service.js).
  CHAT_MESSAGE_SENT: 'chat.message_sent', // { message, conversationId, senderId, recipientId }
  CHAT_CONVERSATION_READ: 'chat.conversation_read', // { conversationId, readBy, otherParticipantId }
  // Setelah notification.listener membuat baris Notification, emit event ini agar
  // socket.js bisa push real-time ke room profile penerima.
  NOTIFICATION_CREATED: 'notification.created', // { notification }
};

eventBus.onAny((event, value) => {
  logger.debug('event emitted', { event, ...(typeof value === 'object' ? value : { value }) });
});

module.exports = { eventBus, EVENTS };
