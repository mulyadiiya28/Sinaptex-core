/**
 * @openapi
 * tags:
 *   name: BusinessDiagnosis
 *   description: |
 *     Business Diagnosis Engine (Phase 20, 22) — Consultants-level diagnostic workflow.
 *     Starts from high-level business SYMPTOMS (e.g. "Declining Sales"), determines measurable
 *     FACTORS (auto-resolved from platform metrics or submitted manually), and evaluates deterministic
 *     RULES to identify the true ROOT CAUSE without AI hallucination.
 *
 * components:
 *   schemas:
 *     DiagnosticFactor:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Monthly Conversion Rate"
 *         dataType:
 *           type: string
 *           enum: [NUMERIC, PERCENTAGE, BOOLEAN, CATEGORICAL]
 *           example: "PERCENTAGE"
 *         sourceType:
 *           type: string
 *           enum: [AUTO_PLATFORM, MANUAL_INPUT]
 *           example: "AUTO_PLATFORM"
 *         autoSourceKey:
 *           type: string
 *           nullable: true
 *           example: "conversion_rate_30d"
 *         unit:
 *           type: string
 *           nullable: true
 *           example: "%"
 *         order:
 *           type: integer
 *           example: 1
 *
 *     BusinessSymptom:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Penjualan Menurun"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Omset atau jumlah transaksi mengalami tren penurunan signifikan dalam 30-90 hari terakhir."
 *         factors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DiagnosticFactor'
 *
 *     BusinessDiagnosisSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [DATA_COLLECTION, DIAGNOSED, INSUFFICIENT_DATA, CLOSED]
 *           example: "DATA_COLLECTION"
 *         symptomId:
 *           type: string
 *           format: uuid
 *         partyId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         diagnosedRootCauseId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         confidenceScore:
 *           type: number
 *           example: 0.85
 *         diagnosedRootCause:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *               example: "Skill Gap Tim Sales"
 *             explanation:
 *               type: string
 *               example: "Tingkat konversi tim penjualan rendah karena minimnya pelatihan negosiasi dan product knowledge."
 *             recommendationType:
 *               type: string
 *               enum: [ADVISORY_ONLY, MATCH_OPPORTUNITY, HYBRID]
 *               example: "HYBRID"
 *         factorValues:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               factorId:
 *                 type: string
 *                 format: uuid
 *               value:
 *                 type: string
 *                 example: "8"
 *               source:
 *                 type: string
 *                 enum: [AUTO_PLATFORM, MANUAL_INPUT]
 *                 example: "MANUAL_INPUT"
 *               factor:
 *                 $ref: '#/components/schemas/DiagnosticFactor'
 *
 *     DiagnosisRecommendationItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [ADVISORY, OPPORTUNITY_MATCH]
 *           example: "ADVISORY"
 *         confidence:
 *           type: number
 *           example: 0.9
 *         isDataGapAlert:
 *           type: boolean
 *           example: false
 *         reasoning:
 *           type: string
 *           example: "Akar masalah teridentifikasi: Skill Gap Tim Sales."
 *         advisoryContentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         opportunityId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *
 * /business-diagnosis/symptoms:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: List all available business symptoms
 *     description: Retrieve the catalog of business symptoms along with their measurable diagnostic factors.
 *     responses:
 *       200:
 *         description: List of symptoms returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OK"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BusinessSymptom'
 *
 * /business-diagnosis/sessions:
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Start a new diagnosis session
 *     description: |
 *       Initializes a diagnosis session. If a valid `partyId` belonging to the authenticated profile is provided,
 *       the engine automatically resolves factors marked as `AUTO_PLATFORM` from real business transaction and activity metrics.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symptomId
 *             properties:
 *               symptomId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the selected symptom
 *                 example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *               partyId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional ID of the Party owned by the user to auto-populate metrics
 *                 example: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
 *     responses:
 *       201:
 *         description: Diagnosis session created and evaluated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Diagnosis session started"
 *                 data:
 *                   type: object
 *                   properties:
 *                     diagnosis:
 *                       $ref: '#/components/schemas/BusinessDiagnosisSession'
 *                     pendingFactors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DiagnosticFactor'
 *                     autoResolvedFactors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           factorId:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           value:
 *                             type: string
 *                           source:
 *                             type: string
 *                             example: "AUTO_PLATFORM"
 *       400:
 *         description: Invalid input or missing required fields
 *       401:
 *         description: Unauthorized - missing token
 *       403:
 *         description: Forbidden - authenticated user does not own the provided partyId
 *
 * /business-diagnosis/sessions/{id}:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: Retrieve diagnosis session state
 *     description: Returns current evaluation status, diagnosed root cause, factor values, and pending factors.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Diagnosis session UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BusinessDiagnosisSession'
 *       404:
 *         description: Diagnosis session not found
 *
 * /business-diagnosis/sessions/{id}/factors:
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Submit a manual diagnostic factor value
 *     description: Records a factor value and re-triggers the deterministic rule evaluation engine.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Diagnosis session UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - factorId
 *               - value
 *             properties:
 *               factorId:
 *                 type: string
 *                 format: uuid
 *                 example: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *               value:
 *                 type: string
 *                 description: Value of the factor formatted as string ("8", "true", "low")
 *                 example: "8"
 *     responses:
 *       200:
 *         description: Factor value accepted and session re-evaluated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Factor value recorded"
 *                 data:
 *                   type: object
 *                   properties:
 *                     diagnosis:
 *                       $ref: '#/components/schemas/BusinessDiagnosisSession'
 *                     pendingFactors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DiagnosticFactor'
 *       409:
 *         description: Conflict - session already closed or invalid factor
 *
 * /business-diagnosis/sessions/{id}/recommendations:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: Get final recommendations for a diagnosis session
 *     description: |
 *       Retrieves the final actionable outcomes for the diagnosed root cause:
 *       - **ADVISORY**: Curated consulting steps or published expert advice.
 *       - **OPPORTUNITY_MATCH**: Real matching Opportunities in the marketplace answering the need.
 *       - **DATA_GAP_ALERT**: Transparent disclosure if verified data or matching opportunities are currently insufficient.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Diagnosis session UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Recommendations generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     diagnosis:
 *                       $ref: '#/components/schemas/BusinessDiagnosisSession'
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DiagnosisRecommendationItem'
 *                     alert:
 *                       type: string
 *                       nullable: true
 *
 * /business-diagnosis/knowledge:
 *   get:
 *     tags: [BusinessDiagnosis]
 *     summary: List complete diagnostic knowledge base
 *     description: Public endpoint to view transparent diagnosis trees (Symptom → Factors → RootCauses → Rules & Advisories).
 *     responses:
 *       200:
 *         description: Knowledge base items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *   post:
 *     tags: [BusinessDiagnosis]
 *     summary: Create or update diagnostic knowledge entry (Admin only)
 *     description: Adds curated symptoms, measurable factors, root causes, conditions, and draft advisories.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symptom
 *               - factors
 *               - rootCauses
 *             properties:
 *               symptom:
 *                 type: object
 *                 required:
 *                   - name
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Penurunan Konversi Leads"
 *                   description:
 *                     type: string
 *                     example: "Leads masuk banyak namun rasio closing rendah"
 *               factors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - dataType
 *                     - sourceType
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Lead Response Time"
 *                     dataType:
 *                       type: string
 *                       enum: [NUMERIC, PERCENTAGE, BOOLEAN, CATEGORICAL]
 *                     sourceType:
 *                       type: string
 *                       enum: [AUTO_PLATFORM, MANUAL_INPUT]
 *                     autoSourceKey:
 *                       type: string
 *                     unit:
 *                       type: string
 *                       example: "minutes"
 *                     order:
 *                       type: integer
 *               rootCauses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - explanation
 *                     - recommendationType
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Follow-up Response Lambat"
 *                     explanation:
 *                       type: string
 *                       example: "Response time lebih dari 60 menit menurunkan closing rate hingga 70%."
 *                     recommendationType:
 *                       type: string
 *                       enum: [ADVISORY_ONLY, MATCH_OPPORTUNITY, HYBRID]
 *                     rules:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           priority:
 *                             type: integer
 *                           conditions:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 factorName:
 *                                   type: string
 *                                 operator:
 *                                   type: string
 *                                   enum: [LT, LTE, GT, GTE, EQ, NEQ, IS_TRUE, IS_FALSE, IN]
 *                                 value:
 *                                   oneOf:
 *                                     - type: number
 *                                     - type: string
 *                                     - type: boolean
 *                                     - type: array
 *                                       items:
 *                                         type: string
 *     responses:
 *       201:
 *         description: Knowledge entry created successfully
 *       403:
 *         description: Forbidden - Admin role required
 *
 * /business-diagnosis/advisory/{id}/publish:
 *   patch:
 *     tags: [BusinessDiagnosis]
 *     summary: Publish advisory content after human review (Admin only)
 *     description: Review gate to approve and publish draft or AI-generated advisory content for end-users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Advisory content UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Advisory content published
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Advisory content not found
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

