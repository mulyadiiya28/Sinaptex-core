/**
 * Admin routes — require BusinessRole ADMIN
 *
 * @openapi
 * tags:
 *   name: Admin
 *   description: Semua endpoint di bawah ini butuh role ADMIN (`requireAuth` + `requireRole('ADMIN')`)
 *
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Statistik ringkas platform (user, opportunity, deal, revenue, dst)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Statistik dashboard }
 *       403: { description: Bukan role ADMIN }
 *
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List user (filter search & accountStatus)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: accountStatus
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, BANNED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar user dengan meta pagination }
 *       403: { description: Bukan role ADMIN }
 *
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Detail satu user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Detail user }
 *       404: { description: User tidak ditemukan }
 *
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspend/ban/pulihkan akun
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountStatus]
 *             properties:
 *               accountStatus: { type: string, enum: [ACTIVE, SUSPENDED, BANNED] }
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Wajib diisi bila accountStatus SUSPENDED atau BANNED
 *     responses:
 *       200: { description: Status akun diperbarui }
 *       400: { description: Alasan wajib diisi untuk SUSPENDED/BANNED }
 *       404: { description: User tidak ditemukan }
 *
 * /admin/opportunities:
 *   get:
 *     tags: [Admin]
 *     summary: List Opportunity untuk moderasi
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar Opportunity dengan meta pagination }
 *
 * /admin/opportunities/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Paksa ubah status Opportunity (moderasi)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [DRAFT, ACTIVE, CLOSED, EXPIRED, CANCELLED] }
 *               moderationNote: { type: string, maxLength: 1000 }
 *     responses:
 *       200: { description: Status Opportunity diperbarui }
 *       404: { description: Opportunity tidak ditemukan }
 *
 * /admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: List Review untuk moderasi
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: hidden
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar Review dengan meta pagination }
 *
 * /admin/reviews/{id}/visibility:
 *   patch:
 *     tags: [Admin]
 *     summary: Sembunyikan/tampilkan Review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hidden]
 *             properties:
 *               hidden: { type: boolean }
 *               hiddenReason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Wajib diisi bila hidden = true
 *     responses:
 *       200: { description: Visibilitas Review diperbarui }
 *       400: { description: hiddenReason wajib diisi ketika hidden = true }
 *       404: { description: Review tidak ditemukan }
 *
 * /admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: List laporan user (report peer)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, REVIEWED, DISMISSED, ACTION_TAKEN] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar laporan dengan meta pagination }
 *
 * /admin/reports/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Tinjau satu laporan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [REVIEWED, DISMISSED, ACTION_TAKEN] }
 *               adminNote: { type: string, maxLength: 1000 }
 *     responses:
 *       200: { description: Laporan diperbarui }
 *       404: { description: Laporan tidak ditemukan }
 *
 * /admin/transactions:
 *   get:
 *     tags: [Admin]
 *     summary: List transaksi membership/boost lintas semua user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Daftar transaksi dengan meta pagination }
 *
 * /admin/settings/chat-rate-limit:
 *   get:
 *     tags: [Admin]
 *     summary: Ambil setting rate-limit chat aktif (DB override atau default env)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Setting rate-limit chat aktif }
 *   patch:
 *     tags: [Admin]
 *     summary: Update setting rate-limit chat (disimpan ke DB, override default env)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxNewConvFree: { type: integer, minimum: 1, maximum: 1000 }
 *               maxNewConvMember: { type: integer, minimum: 1, maximum: 5000 }
 *               unrepliedBurstMax: { type: integer, minimum: 1, maximum: 500 }
 *               unrepliedBurstWindowMs: { type: integer, minimum: 60000, maximum: 86400000 }
 *               redisTtlSeconds: { type: integer, minimum: 3600, maximum: 604800 }
 *     responses:
 *       200: { description: Setting rate-limit chat diperbarui }
 *       400: { description: Minimal satu field harus diisi }
 *
 * /admin/content/pages:
 *   get:
 *     tags: [Admin]
 *     summary: List semua halaman statis (semua status, termasuk DRAFT)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar halaman }
 *
 * /admin/content/pages/{slug}:
 *   get:
 *     tags: [Admin]
 *     summary: Detail satu halaman (semua status)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, pattern: '^[a-z0-9-]+$' }
 *     responses:
 *       200: { description: Detail halaman }
 *       404: { description: Halaman tidak ditemukan }
 *   put:
 *     tags: [Admin]
 *     summary: Upsert halaman (buat baru atau update, sekaligus set status)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, pattern: '^[a-z0-9-]+$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string, minLength: 1, maxLength: 200 }
 *               content: { type: string, minLength: 1 }
 *               status: { type: string, enum: [DRAFT, PUBLISHED] }
 *     responses:
 *       200: { description: Halaman dibuat/diperbarui }
 *       400: { description: Validasi gagal }
 *
 * /admin/content/faq:
 *   get:
 *     tags: [Admin]
 *     summary: List semua FAQ (semua status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar FAQ }
 *   post:
 *     tags: [Admin]
 *     summary: Buat FAQ baru
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, answer]
 *             properties:
 *               question: { type: string, minLength: 3, maxLength: 300 }
 *               answer: { type: string, minLength: 3, maxLength: 3000 }
 *               order: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED] }
 *     responses:
 *       201: { description: FAQ dibuat }
 *       400: { description: Validasi gagal }
 *
 * /admin/content/faq/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update satu FAQ
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question: { type: string, minLength: 3, maxLength: 300 }
 *               answer: { type: string, minLength: 3, maxLength: 3000 }
 *               order: { type: integer }
 *               status: { type: string, enum: [DRAFT, PUBLISHED] }
 *     responses:
 *       200: { description: FAQ diperbarui }
 *       404: { description: FAQ tidak ditemukan }
 *   delete:
 *     tags: [Admin]
 *     summary: Hapus satu FAQ
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: FAQ dihapus }
 *       404: { description: FAQ tidak ditemukan }
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
