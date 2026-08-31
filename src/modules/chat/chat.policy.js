const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const membershipService = require('../membership/membership.service');

/**
 * CONVERSATION POLICY — semua aturan bisnis chat hidup DI SINI.
 *
 * Business rule (FR-16 & FR-17):
 *   - originType NEED / OFFER -> gratis, TIDAK ADA gating membership.
 *     Pengguna dapat berinteraksi langsung dari kartu Need maupun Offer.
 *   - originType PROFILE (Cold DM / chat langsung tanpa kartu opportunity) ->
 *     recipient wajib memiliki membership aktif untuk menyaring unsolicited messages.
 *   - Conversation yang SUDAH ADA selalu boleh dilanjutkan (reply), apa pun
 *     originType dan status membership saat ini.
 */

async function canStartConversation({ initiatorProfileId, recipientProfileId, originType }) {
  if (initiatorProfileId === recipientProfileId) {
    return {
      allowed: false,
      reason: 'Tidak bisa memulai percakapan dengan diri sendiri',
      code: ErrorCodes.SELF_CONVERSATION,
    };
  }

  // originType NEED atau OFFER berasal dari interaksi kartu Opportunity (bebas biaya/tanpa gating membership)
  if (originType === 'NEED' || originType === 'OFFER') {
    return { allowed: true, reason: null, code: null };
  }

  // originType PROFILE (Cold direct chat) -> recipient wajib member aktif untuk mencegah spam
  const recipientActive = await membershipService.hasActiveMembership(recipientProfileId);
  if (!recipientActive) {
    return {
      allowed: false,
      reason: 'Tidak bisa memulai direct chat: penerima belum memiliki membership aktif.',
      code: ErrorCodes.MEMBERSHIP_REQUIRED,
    };
  }

  return { allowed: true, reason: null, code: null };
}

/** Placeholder untuk aturan reply di masa depan (mis. block user, conversation di-archive, dst). */
function canReplyConversation() {
  return { allowed: true, reason: null, code: null };
}

function canViewConversation(participantIds, profileId) {
  const allowed = participantIds.includes(profileId);
  return {
    allowed,
    reason: allowed ? null : 'You are not part of this conversation',
    code: allowed ? null : ErrorCodes.NOT_CONVERSATION_PARTICIPANT,
  };
}

/** Placeholder — belum ada fitur hapus conversation di MVP, disiapkan strukturnya saja. */
function canDeleteConversation() {
  return {
    allowed: false,
    reason: 'Menghapus percakapan belum didukung di MVP ini',
    code: ErrorCodes.FORBIDDEN,
  };
}

async function assertCanStartConversation(params) {
  const result = await canStartConversation(params);
  if (!result.allowed) throw ApiError.forbidden(result.reason, result.code);
}

function assertCanView(participantIds, profileId) {
  const result = canViewConversation(participantIds, profileId);
  if (!result.allowed) throw ApiError.forbidden(result.reason, result.code);
}

module.exports = {
  canStartConversation,
  canReplyConversation,
  canViewConversation,
  canDeleteConversation,
  assertCanStartConversation,
  assertCanView,
};
