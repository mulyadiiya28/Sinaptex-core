/**
 * Admin routes — require BusinessRole ADMIN
 */
const router = require('express').Router();
const {
  getDashboard,
  listUsers,
  getUser,
  suspendUser,
  listOpportunitiesForModeration,
  forceUpdateOpportunityStatus,
  listReviewsForModeration,
  setReviewVisibility,
  listReports,
  reviewReport,
  listTransactions,
  getChatRateLimitSettings,
  updateChatRateLimitSettings,
} = require('./admin.controller');
const {
  listPagesAdmin,
  getPageAdmin,
  upsertPage,
  listFaqAdmin,
  createFaq,
  updateFaq,
  deleteFaq,
} = require('../content/content.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  idParamSchema,
  listUsersSchema,
  suspendUserSchema,
  listOpportunitiesModerationSchema,
  forceUpdateOpportunitySchema,
  listReviewsModerationSchema,
  setReviewVisibilitySchema,
  listReportsSchema,
  reviewReportSchema,
  listTransactionsSchema,
  updateChatRateLimitSchema,
} = require('../../validations/admin.validation');
const {
  slugParamSchema,
  upsertPageSchema,
  idParamSchema: contentIdParamSchema,
  createFaqSchema,
  updateFaqSchema,
} = require('../../validations/content.validation');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', getDashboard);

router.get('/users', validate(listUsersSchema), listUsers);
router.get('/users/:id', validate(idParamSchema), getUser);
router.patch('/users/:id/status', validate(suspendUserSchema), suspendUser);

router.get('/opportunities', validate(listOpportunitiesModerationSchema), listOpportunitiesForModeration);
router.patch(
  '/opportunities/:id/status',
  validate(forceUpdateOpportunitySchema),
  forceUpdateOpportunityStatus
);

router.get('/reviews', validate(listReviewsModerationSchema), listReviewsForModeration);
router.patch('/reviews/:id/visibility', validate(setReviewVisibilitySchema), setReviewVisibility);

router.get('/reports', validate(listReportsSchema), listReports);
router.patch('/reports/:id', validate(reviewReportSchema), reviewReport);

router.get('/transactions', validate(listTransactionsSchema), listTransactions);

// Platform settings — chat anti-spam limits (env default + DB override)
router.get('/settings/chat-rate-limit', getChatRateLimitSettings);
router.patch(
  '/settings/chat-rate-limit',
  validate(updateChatRateLimitSchema),
  updateChatRateLimitSettings
);

router.get('/content/pages', listPagesAdmin);
router.get('/content/pages/:slug', validate(slugParamSchema), getPageAdmin);
router.put('/content/pages/:slug', validate(upsertPageSchema), upsertPage);
router.get('/content/faq', listFaqAdmin);
router.post('/content/faq', validate(createFaqSchema), createFaq);
router.patch('/content/faq/:id', validate(updateFaqSchema), updateFaq);
router.delete('/content/faq/:id', validate(contentIdParamSchema), deleteFaq);

module.exports = router;
