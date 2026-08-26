/**
 * @openapi
 * tags:
 *   name: Admin
 *   description: MVP Phase 12 — dashboard & moderasi. Semua endpoint di bawah butuh BusinessRole ADMIN.
 *
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Statistik ringkas platform (users, opportunities, deals, revenue, pending items)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List semua user (filter search, accountStatus)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Detail user (profile, roles, parties, membership)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend/ban/pulihkan akun user
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/opportunities:
 *   get:
 *     tags: [Admin]
 *     summary: List semua Opportunity untuk moderasi (termasuk non-public)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/opportunities/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Paksa ubah status Opportunity (moderasi pelanggaran)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: List Review untuk moderasi
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/reviews/{id}/visibility:
 *   patch:
 *     tags: [Admin]
 *     summary: Sembunyikan/tampilkan kembali sebuah Review
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: List laporan user (filter status)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/reports/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Tinjau laporan (REVIEWED/DISMISSED/ACTION_TAKEN)
 *     security: [{ bearerAuth: [] }]
 *
 * /admin/transactions:
 *   get:
 *     tags: [Admin]
 *     summary: List transaksi membership lintas semua user (filter status)
 *     security: [{ bearerAuth: [] }]
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
router.patch('/opportunities/:id/status', validate(forceUpdateOpportunitySchema), forceUpdateOpportunityStatus);

router.get('/reviews', validate(listReviewsModerationSchema), listReviewsForModeration);
router.patch('/reviews/:id/visibility', validate(setReviewVisibilitySchema), setReviewVisibility);

router.get('/reports', validate(listReportsSchema), listReports);
router.patch('/reports/:id', validate(reviewReportSchema), reviewReport);

router.get('/transactions', validate(listTransactionsSchema), listTransactions);

// Content/CMS management (MVP Phase 1) — namespace /admin/content/* biar konsisten
// dengan admin surface lain, meski logic-nya hidup di modul content/.
router.get('/content/pages', listPagesAdmin);
router.get('/content/pages/:slug', validate(slugParamSchema), getPageAdmin);
router.put('/content/pages/:slug', validate(upsertPageSchema), upsertPage);
router.get('/content/faq', listFaqAdmin);
router.post('/content/faq', validate(createFaqSchema), createFaq);
router.patch('/content/faq/:id', validate(updateFaqSchema), updateFaq);
router.delete('/content/faq/:id', validate(contentIdParamSchema), deleteFaq);

module.exports = router;
