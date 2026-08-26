/**
 * @openapi
 * tags:
 *   name: BusinessDiagnosis
 *   description: |
 *     Business Diagnosis Engine (Phase 20, "level konsultan") — mulai dari GEJALA
 *     bisnis (mis. "Penjualan Menurun"), mendiagnosis akar masalah dari DATA
 *     TERUKUR (auto-tarik dari histori Party kalau ada, manual kalau tidak),
 *     lewat aturan deterministik. Hasil bisa ADVISORY_ONLY (saran murni, tanpa
 *     produk), MATCH_OPPORTUNITY (baru cari solusi marketplace), atau HYBRID.
 *     Lihat docs/business-decision-philosophy.md.
 *
 * /business-diagnosis/symptoms:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: List gejala bisnis yang tersedia di basis pengetahuan
 *
 * /business-diagnosis/sessions:
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Mulai sesi diagnosis. Kalau partyId disertakan, factor AUTO_PLATFORM ditarik otomatis dari histori nyata Party.
 *     security: [{ bearerAuth: [] }]
 *
 * /business-diagnosis/sessions/{id}:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: Status diagnosis saat ini (rootCause terdiagnosis, confidence, pendingFactors)
 *
 * /business-diagnosis/sessions/{id}/factors:
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Isi satu DiagnosticFactor secara manual, memicu evaluasi ulang rule
 *
 * /business-diagnosis/sessions/{id}/recommendations:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: Ambil rekomendasi akhir — advisory dan/atau match Opportunity, atau data-gap alert
 *
 * /business-diagnosis/knowledge:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: List basis pengetahuan diagnosis (symptom -> rootCause -> rule/advisory)
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Tambah basis pengetahuan baru (admin only)
 *     security: [{ bearerAuth: [] }]
 *
 * /business-diagnosis/advisory/{id}/publish:
 *   patch:
 *     tags: [BusinessDiagnosis]
 *     summary: Review gate — publikasikan draft advisory (termasuk draft AI) supaya boleh ditampilkan ke user (admin only)
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const {
  listSymptoms,
  startDiagnosis,
  getDiagnosis,
  submitFactor,
  getRecommendations,
  createKnowledge,
  listKnowledge,
  publishAdvisory,
} = require('./diagnosis.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const deprecated = require('../../middlewares/deprecated.middleware');
const {
  startDiagnosisSchema,
  idParamSchema,
  submitFactorSchema,
  createKnowledgeSchema,
} = require('../../validations/business-diagnosis.validation');

router.get('/symptoms', listSymptoms);

// Sesi diagnosis butuh login: engine ini menarik data histori NYATA milik Party
// user (kalau ada), jadi harus tahu siapa yang bertanya.
router.post(
  '/sessions',
  deprecated(
    'Untuk entry point tunggal dari kalimat bebas, pakai POST /api/v1/intent — endpoint ini tetap aktif untuk pemanggilan terstruktur langsung (mis. dari dashboard admin).',
    '/api/v1/intent'
  ),
  requireAuth,
  validate(startDiagnosisSchema),
  startDiagnosis
);
router.get('/sessions/:id', validate(idParamSchema), getDiagnosis);
router.post('/sessions/:id/factors', validate(submitFactorSchema), submitFactor);
router.get('/sessions/:id/recommendations', validate(idParamSchema), getRecommendations);

router.get('/knowledge', listKnowledge);
router.post('/knowledge', requireAuth, requireRole('ADMIN'), validate(createKnowledgeSchema), createKnowledge);
router.patch('/advisory/:id/publish', requireAuth, requireRole('ADMIN'), validate(idParamSchema), publishAdvisory);

module.exports = router;
