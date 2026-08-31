const router = require('express').Router();

/* ============================================================
 * PHASE 0 : FOUNDATION (halaman statis / CMS ringan)
 * ============================================================ */

router.use('/content', require('../../modules/content/content.routes'));

/* ============================================================
 * PHASE 1 : ENTRY POINT
 * ============================================================ */
// Health check stays unversioned (infra/monitoring tooling shouldn't need to track API versions)
router.get('/health', require('../health.route'));

// Semua request bisnis (bahasa bebas) masuk dari sini — lihat src/modules/intent/.
router.use('/intent', require('../../modules/intent/intent.routes'));

/* ============================================================
 * PHASE 2 : IDENTITY
 * ============================================================ */

router.use('/auth', require('../../modules/auth/auth.routes'));
router.use('/profiles', require('../../modules/profile/profile.routes'));
router.use('/parties', require('../../modules/party/party.routes'));
router.use('/verification-documents', require('../../modules/verification/verification.routes'));

/* ============================================================
 * PHASE 3 : BUSINESS
 * ============================================================ */

router.use('/opportunities', require('../../modules/opportunity/opportunity.routes'));
router.use('/matching', require('../../modules/matching/matching.routes'));
router.use('/invitations', require('../../modules/invitation/invitation.routes'));

/* ============================================================
 * PHASE 4 : COMMUNICATION
 * ============================================================ */

router.use('/chat', require('../../modules/chat/chat.routes'));
router.use('/notifications', require('../../modules/notification/notification.routes'));

/* ============================================================
 * PHASE 5 : TRUST
 * ============================================================ */

router.use('/reviews', require('../../modules/review/review.routes'));
router.use('/reports', require('../../modules/report/report.routes'));

/* ============================================================
 * PHASE 6 : MONETIZATION
 * ============================================================ */

router.use('/membership', require('../../modules/membership/membership.routes'));
router.use('/pricing', require('../../modules/pricing/pricing.routes'));
router.use('/boosts', require('../../modules/boost/boost.routes'));
router.use('/escrow', require('../../modules/escrow/escrow.routes'));

// Belum jadi modul terpisah — saat ini hidup di dalam Membership (webhook per-
// provider di /membership/webhook/:provider, invoice di MembershipTransaction).
// Pisahkan ke /payments, /invoices, /subscriptions HANYA kalau ada produk
// berbayar kedua (Featured Offer, AI Credit, dst) yang butuh checkout sendiri —
// jangan dipisah lebih awal dari itu (YAGNI).
// router.use('/payments', require('../../modules/payment/payment.routes'));
// router.use('/invoices', require('../../modules/invoice/invoice.routes'));
// router.use('/subscriptions', require('../../modules/subscription/subscription.routes'));

/* ============================================================
 * PHASE 7 : PLATFORM OPERATIONS (Admin)
 * ============================================================ */

router.use('/admin', require('../../modules/admin/admin.routes'));

/* ============================================================
 * DIBEKUKAN — kode tetap ada & tetap aktif di sini, bukan dihapus,
 * bukan fokus pengembangan sampai MVP di atas live (lihat catatan
 * pivot di docs/PROJECT_CHECKLIST.md).
 * ============================================================ */

router.use('/fraud-flags', require('../../modules/fraud/fraud.routes'));
router.use('/decision', require('../../modules/decision/decision.routes'));
router.use('/business-diagnosis', require('../../modules/business-diagnosis/diagnosis.routes'));

/* ============================================================
 * ROADMAP — belum ada modulnya sama sekali, bukan dibekukan (karena
 * belum pernah dibangun), cuma dipetakan di sini supaya arah jangka
 * panjang platform (Business Decision Platform, bukan sekadar
 * marketplace) terlihat dari struktur router-nya sejak awal.
 *
 * Pipeline: Intent -> Diagnosis -> RootCause (bagian dari Diagnosis)
 *           -> Decision (ActionPlan) -> Workflow -> Task -> KPI -> Evaluation
 * ============================================================ */
// router.use('/workflow', require('../../modules/workflow/workflow.routes'));
// router.use('/tasks', require('../../modules/task/task.routes'));
// router.use('/kpi', require('../../modules/kpi/kpi.routes'));
// router.use('/evaluation', require('../../modules/evaluation/evaluation.routes'));
// router.use('/analytics', require('../../modules/analytics/analytics.routes'));
// router.use('/knowledge', require('../../modules/knowledge/knowledge.routes'));
// router.use('/ai', require('../../modules/ai/ai.routes'));

module.exports = router;
