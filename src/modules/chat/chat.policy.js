const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const membershipService = require('../membership/membership.service');

/**
 * CONVERSATION POLICY — semua aturan bisnis chat hidup DI SINI, terpisah dari
 * ConversationService yang fokus orkestrasi/akses data. Kalau aturan bisnis
 * berubah (mis. nanti ada tier membership berbeda), cukup ubah file ini.
 *
 * Business rule (hasil diskusi ulang domain):
 *   - originType NEED  -> gratis, TIDAK ADA gating membership sama sekali
 *     (provider merespons Need orang lain — Need selalu gratis)
 *   - originType OFFER -> recipient (pemilik Offer, bertindak sebagai Provider)
 *     WAJIB member aktif sebelum conversation BARU bisa dibuat
 *   - originType PROFILE (chat langsung, bukan dari Need/Offer) -> recipient
 *     WAJIB member aktif juga (default paling aman: dia dihubungi sebagai
 *     penyedia jasa/expertise, sama seperti OFFER)
 *   - Conversation yang SUDAH ADA selalu boleh dilanjutkan, apa pun originType
 *     dan status membership saat ini (gating cuma berlaku saat membuat BARU)
 */

async function canStartConversation({ initiatorProfileId, recipientProfileId, originType }) {
  if (initiatorProfileId === recipientProfileId) {
    return {
      allowed: false,
      reason: 'Tidak bisa memulai percakapan dengan diri sendiri',
      code: ErrorCodes.SELF_CONVERSATION,
    };
  }

  if (originType === 'NEED') {
    // Need selalu gratis — TIDAK cek membership milik siapa pun di jalur ini.
    return { allowed: true, reason: null, code: null };
  }

  // originType OFFER atau PROFILE -> recipient bertindak sebagai Provider, wajib member aktif.
  const recipientActive = await membershipService.hasActiveMembership(recipientProfileId);
  if (!recipientActive) {
    return {
      allowed: false,
      reason: 'Tidak bisa memulai percakapan baru: penerima belum memiliki membership aktif.',
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
