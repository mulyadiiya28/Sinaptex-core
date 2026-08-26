module.exports = {
  MAX_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MATCHING_CANDIDATE_POOL_SIZE: 200, // lihat matching.controller.js
  REVIEW_RATING_MIN: 1,
  REVIEW_RATING_MAX: 5,
  RECENT_ACTIVITY_WINDOW_DAYS: 30, // dipakai partyStats.service.js untuk activityScore
  INVITATION_EXPIRY_DAYS: 14, // invitation PENDING lebih lama dari ini otomatis EXPIRED
  NOTIFICATION_RETENTION_DAYS: 90, // notifikasi terbaca dihapus setelah ini (cleanup job)
};
