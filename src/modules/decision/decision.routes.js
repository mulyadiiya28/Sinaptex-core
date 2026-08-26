/**
 * @openapi
 * tags:
 *   name: Decision
 *   description: |
 *     Business Decision Engine (Jobs-to-be-Done / Root-Cause Engine) — duduk DI ATAS
 *     Matching Engine. Mendiagnosis kebutuhan sebenarnya di balik permintaan permukaan
 *     (mis. "saya butuh CRM" -> "supaya follow-up pelanggan tidak bocor"), lalu mencari
 *     Opportunity NYATA yang menjawabnya. Kalau data tidak cukup, WAJIB jujur (data gap
 *     alert), tidak pernah mengarang rekomendasi. Lihat docs/business-decision-philosophy.md.
 *
 * /decision/inquiries:
 *   post:
 *     tags: [Decision]
 *     summary: Mulai sesi diagnosis dari permintaan mentah user
 *     description: Bisa dipanggil tanpa login (anonim) maupun dengan Bearer token (dikaitkan ke profile).
 *     responses:
 *       201: { description: "Inquiry dibuat. Kalau statedWant tidak match basis pengetahuan manapun, status = CLOSED_NO_DATA dengan alert jujur." }
 *
 * /decision/inquiries/{id}:
 *   get:
 *     tags: [Decision]
 *     summary: Lihat status diagnosis saat ini (Job terdiagnosis, confidence, dataSufficiency)
 *
 * /decision/inquiries/{id}/answers:
 *   post:
 *     tags: [Decision]
 *     summary: Jawab satu pertanyaan klarifikasi, memicu re-diagnosis
 *
 * /decision/inquiries/{id}/recommendations:
 *   get:
 *     tags: [Decision]
 *     summary: Ambil rekomendasi final — Opportunity nyata, atau data-gap alert kalau tidak ada
 *
 * /decision/knowledge:
 *   get:
 *     tags: [Decision]
 *     summary: List seluruh basis pengetahuan (SolutionCategory -> Job -> RootProblem)
 *   post:
 *     tags: [Decision]
 *     summary: Tambah entri basis pengetahuan baru (admin only)
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const {
  startInquiry,
  getInquiry,
  submitAnswer,
  getRecommendations,
  createKnowledge,
  listKnowledge,
} = require('./decision.controller');
const { optionalAuth, requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const deprecated = require('../../middlewares/deprecated.middleware');
const {
  startInquirySchema,
  idParamSchema,
  submitAnswerSchema,
  createKnowledgeSchema,
} = require('../../validations/decision.validation');

// Public inquiry flow — bisa dipakai tanpa login supaya siapa pun bisa mengambil
// keputusan berdasarkan data, bukan cuma pengguna terverifikasi.
router.post(
  '/inquiries',
  deprecated(
    'Untuk entry point tunggal dari kalimat bebas, pakai POST /api/v1/intent — endpoint ini tetap aktif untuk pemanggilan terstruktur langsung.',
    '/api/v1/intent'
  ),
  optionalAuth,
  validate(startInquirySchema),
  startInquiry
);
router.get('/inquiries/:id', validate(idParamSchema), getInquiry);
router.post('/inquiries/:id/answers', validate(submitAnswerSchema), submitAnswer);
router.get('/inquiries/:id/recommendations', validate(idParamSchema), getRecommendations);

// Knowledge base — baca publik (transparan), tulis admin-only (basis pengetahuan
// terkurasi, bukan generatif bebas).
router.get('/knowledge', listKnowledge);
router.post('/knowledge', requireAuth, requireRole('ADMIN'), validate(createKnowledgeSchema), createKnowledge);

module.exports = router;
