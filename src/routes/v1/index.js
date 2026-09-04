/**
 * API v1 router — single source of truth for HTTP route mounts.
 *
 * Mounted by the app roughly as:
 *   app.use('/api/v1', require('./routes/v1'));
 *
 * Design rules:
 * - Order of registration follows product phases (Foundation → Admin).
 * - Frozen / roadmap modules stay listed here so the long-term map is visible.
 * - Do not register incomplete modules without a comment explaining why.
 * - Marketplace is intentionally lean (catalog + cart + order + product review).
 *   Cash book, debt, receivable, inventory ledgers belong in Business Suite.
 */

const router = require('express').Router();

/* ============================================================
 * PHASE 0 : FOUNDATION
 * Static / CMS-lite pages (legal, FAQ, landing copy).
 * Public-friendly; keep dependencies minimal.
 * ============================================================ */

router.use('/content', require('../../modules/content/content.routes'));

/* ============================================================
 * PHASE 1 : ENTRY POINT
 * Health for ops/monitoring; Intent as the natural-language entry
 * into the business decision pipeline.
 * ============================================================ */

// GET /api/v1/health — database (critical), redis/cache (optional), socket stats
router.get('/health', require('../health.route'));

// Free-form business requests → intent module
router.use('/intent', require('../../modules/intent/intent.routes'));

/* ============================================================
 * PHASE 2 : IDENTITY
 * Who is the user, which Party they act as, and KYC documents.
 * ============================================================ */

router.use('/auth', require('../../modules/auth/auth.routes'));
router.use('/profiles', require('../../modules/profile/profile.routes'));
router.use('/parties', require('../../modules/party/party.routes'));
router.use(
  '/verification-documents',
  require('../../modules/verification/verification.routes')
);

/* ============================================================
 * PHASE 3 : BUSINESS MATCHING
 * Supply/demand discovery: opportunities, matching scores, invitations.
 * ============================================================ */

router.use('/opportunities', require('../../modules/opportunity/opportunity.routes'));
router.use('/matching', require('../../modules/matching/matching.routes'));
router.use('/invitations', require('../../modules/invitation/invitation.routes'));

/* ============================================================
 * PHASE 4 : COMMUNICATION
 * Real-time chat + in-app notifications (WS layer is separate: src/core/socket.js).
 * ============================================================ */

router.use('/chat', require('../../modules/chat/chat.routes'));
router.use('/notifications', require('../../modules/notification/notification.routes'));

/* ============================================================
 * PHASE 5 : TRUST
 * Reputation after deals (deal reviews) and safety (reports).
 * Note: product reviews live under marketplace (PHASE 6.5), not here.
 * ============================================================ */

router.use('/reviews', require('../../modules/review/review.routes'));
router.use('/reports', require('../../modules/report/report.routes'));

/* ============================================================
 * PHASE 6 : MONETIZATION
 * Membership plans, pricing surfaces, boost ranking, escrow hold/release.
 *
 * Payments are NOT a separate router yet — checkout + webhooks live under
 * membership (/membership/webhook/:provider). Split only when a second
 * paid product needs its own checkout (YAGNI).
 * ============================================================ */

router.use('/membership', require('../../modules/membership/membership.routes'));
router.use('/pricing', require('../../modules/pricing/pricing.routes'));
router.use('/boosts', require('../../modules/boost/boost.routes'));
router.use('/escrow', require('../../modules/escrow/escrow.routes'));

// Deferred — enable only when a second paid product needs standalone checkout:
// router.use('/payments', require('../../modules/payment/payment.routes'));
// router.use('/invoices', require('../../modules/invoice/invoice.routes'));
// router.use('/subscriptions', require('../../modules/subscription/subscription.routes'));

/* ============================================================
 * PHASE 6.5 : MARKETPLACE (lean)
 *
 * In scope:
 *   - Product catalog (seller listing + public browse)
 *   - Cart + checkout
 *   - Orders (buyer / seller lifecycle)
 *   - Product reviews (distinct from deal reviews in PHASE 5)
 *
 * Out of scope (Business Suite, not marketplace):
 *   - Cash book, debt book, receivable book
 *   - Inventory ledger / HPP
 *   - Debt/receivable reminder crons
 *
 * Soft-launch default: single-seller cart (MP_ORDER_MULTI_SELLER=false).
 * Comment this whole block if marketplace modules are not deployed yet.
 * ============================================================ */

router.use(
  '/marketplace/products',
  require('../../modules/marketplace/product/product.routes')
);
router.use(
  '/marketplace/cart',
  require('../../modules/marketplace/cart/cart.routes')
);
router.use(
  '/marketplace/orders',
  require('../../modules/marketplace/order/order.routes')
);
// review.routes typically mounts paths like /marketplace/products/:id/reviews
router.use('/marketplace', require('../../modules/marketplace/review/review.routes'));

/**
 * Business Suite routes (MVP)
 * Mounted at /api/v1/business-suite
 *
 * Nested paths are party-scoped, e.g.:
 *   GET  /api/v1/business-suite/parties/:partyId/contacts
 *   POST /api/v1/business-suite/parties/:partyId/cashbook
 */

// Master data
router.use(require('../../modules/business-suite/contact/contact.routes'));

// Cash book
router.use(require('../../modules/business-suite/cashbook/cashbook.routes'));

// Cards (piutang / hutang / persediaan)
router.use(require('../../modules/business-suite/receivableCard/receivableCard.routes'));
router.use(require('../../modules/business-suite/debtCard/debtCard.routes'));
router.use(require('../../modules/business-suite/inventoryCard/inventoryCard.routes'));

// Task & agenda
router.use(require('../../modules/business-suite/task/task.routes'));
router.use(require('../../modules/business-suite/agenda/agenda.routes'));

// Dashboard
router.use(require('../../modules/business-suite/dashboard/dashboard.routes'));

/* ============================================================
 * PHASE 7 : PLATFORM OPERATIONS (Admin)
 * Back-office moderation, overrides, operational tooling.
 * ============================================================ */

router.use('/admin', require('../../modules/admin/admin.routes'));

/* ============================================================
 * FROZEN (still mounted — not deleted)
 * Keep code paths alive but they are not the MVP development focus
 * until core phases above are live. See docs/PROJECT_CHECKLIST.md.
 * ============================================================ */

router.use('/fraud-flags', require('../../modules/fraud/fraud.routes'));
router.use('/decision', require('../../modules/decision/decision.routes'));
router.use(
  '/business-diagnosis',
  require('../../modules/business-diagnosis/diagnosis.routes')
);

/* ============================================================
 * ROADMAP (not built yet — mapping only)
 *
 * Long-term product is a Business Decision Platform, not only a
 * marketplace. Intended pipeline:
 *
 *   Intent → Diagnosis → RootCause → Decision (ActionPlan)
 *         → Workflow → Task → KPI → Evaluation
 *
 * Uncomment only when the module exists and has tests.
 * ============================================================ */

// router.use('/workflow', require('../../modules/workflow/workflow.routes'));
// router.use('/tasks', require('../../modules/task/task.routes'));
// router.use('/kpi', require('../../modules/kpi/kpi.routes'));
// router.use('/evaluation', require('../../modules/evaluation/evaluation.routes'));
// router.use('/analytics', require('../../modules/analytics/analytics.routes'));
// router.use('/knowledge', require('../../modules/knowledge/knowledge.routes'));
// router.use('/ai', require('../../modules/ai/ai.routes'));

module.exports = router;