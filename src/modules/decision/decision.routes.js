/**
 * @openapi
 * tags:
 *   name: Decision
 *   description: |
 *     Business Decision Engine (Jobs-to-be-Done / Root-Cause Diagnostic Engine).
 *     Operates above the Matching Engine to diagnose the fundamental underlying business Job
 *     behind a stated raw surface request (e.g. "I want a CRM" → "Preventing customer follow-up leaks").
 *     Employs structured knowledge bases (RootProblem → JobToBeDone → SolutionCategory) and enforces
 *     an anti-hallucination policy with explicit confidence scores and honest data-gap alerts.
 *
 * components:
 *   schemas:
 *     ClarifyingQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         question:
 *           type: string
 *           example: "Berapa banyak leads yang masuk setiap minggunya?"
 *
 *     DecisionInquiry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         statedWant:
 *           type: string
 *           example: "Saya butuh sistem CRM untuk tim sales"
 *         status:
 *           type: string
 *           enum: [IN_PROGRESS, DIAGNOSED, CLOSED_NO_DATA, CLOSED_WITH_RECOMMENDATION]
 *           example: "IN_PROGRESS"
 *         confidenceScore:
 *           type: number
 *           example: 0.8
 *         dataSufficiency:
 *           type: string
 *           enum: [INSUFFICIENT, SUFFICIENT, COMPLETE]
 *           example: "SUFFICIENT"
 *         matchedSolutionCategoryId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         diagnosedJobId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         diagnosedJob:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             statement:
 *               type: string
 *               example: "Memastikan proses follow-up prospek tidak bocor antar salesperson"
 *         pendingQuestions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ClarifyingQuestion'
 *
 *     DecisionRecommendationItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [OPPORTUNITY_MATCH, ADVISORY]
 *           example: "OPPORTUNITY_MATCH"
 *         confidence:
 *           type: number
 *           example: 0.88
 *         isDataGapAlert:
 *           type: boolean
 *           example: false
 *         reasoning:
 *           type: string
 *           example: "Opportunity ini menyediakan modul pipeline kanban dan reminder follow-up otomatis."
 *         opportunity:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             title:
 *               type: string
 *               example: "Aplikasi Lead Management & Follow-up Tracker"
 *
 * /decision/inquiries:
 *   post:
 *     tags: [Decision]
 *     summary: Start a new decision diagnosis inquiry
 *     description: |
 *       Initializes a diagnostic inquiry from a user's stated want.
 *       Can be called anonymously or with a Bearer token to associate the inquiry with an existing Profile.
 *     security:
 *       - {}
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statedWant
 *             properties:
 *               statedWant:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 500
 *                 description: Raw business need or software requirement expressed in natural language
 *                 example: "Saya mencari solusi software untuk mencatat lead penjualan dan tracking closing"
 *     responses:
 *       201:
 *         description: Inquiry initiated and initial diagnosis performed
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
 *                   example: "Inquiry started"
 *                 data:
 *                   $ref: '#/components/schemas/DecisionInquiry'
 *       400:
 *         description: Invalid input parameters
 *
 * /decision/inquiries/{id}:
 *   get:
 *     tags: [Decision]
 *     summary: View decision inquiry diagnosis state
 *     description: Returns the diagnosed Job-to-be-Done, current confidence score, data sufficiency, and remaining clarifying questions.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Decision inquiry UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inquiry state retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DecisionInquiry'
 *       404:
 *         description: Inquiry not found
 *
 * /decision/inquiries/{id}/answers:
 *   post:
 *     tags: [Decision]
 *     summary: Submit an answer to a clarifying question
 *     description: Answers a specific clarifying diagnostic question and triggers an automatic re-evaluation of the diagnosed Job and confidence.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Decision inquiry UUID
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
 *               - questionId
 *               - answer
 *             properties:
 *               questionId:
 *                 type: string
 *                 format: uuid
 *                 example: "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b"
 *               answer:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "Rata-rata 50-100 leads per minggu melalui WhatsApp dan Instagram DM"
 *     responses:
 *       200:
 *         description: Answer saved and diagnosis updated
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
 *                   example: "Answer recorded"
 *                 data:
 *                   $ref: '#/components/schemas/DecisionInquiry'
 *       404:
 *         description: Inquiry or question not found
 *
 * /decision/inquiries/{id}/recommendations:
 *   get:
 *     tags: [Decision]
 *     summary: Retrieve recommendations or data-gap alerts for an inquiry
 *     description: Returns verified matching opportunities or an honest data-gap alert if current platform inventory is insufficient.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Decision inquiry UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Recommendations retrieved
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
 *                     inquiry:
 *                       $ref: '#/components/schemas/DecisionInquiry'
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DecisionRecommendationItem'
 *                     dataGapAlert:
 *                       type: string
 *                       nullable: true
 *       404:
 *         description: Inquiry not found
 *
 * /decision/knowledge:
 *   get:
 *     tags: [Decision]
 *     summary: List complete decision knowledge base
 *     description: Public endpoint to view Solution Categories, Jobs to be Done, and Root Problems.
 *     responses:
 *       200:
 *         description: Knowledge base items
 *   post:
 *     tags: [Decision]
 *     summary: Add new decision knowledge entry (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rootProblem
 *               - job
 *               - solutionCategory
 *             properties:
 *               rootProblem:
 *                 type: object
 *                 required:
 *                   - name
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Kebocoran Follow-up Prospek"
 *                   description:
 *                     type: string
 *                     example: "Prospek tidak ditindaklanjuti tepat waktu"
 *               job:
 *                 type: object
 *                 required:
 *                   - statement
 *                 properties:
 *                   statement:
 *                     type: string
 *                     example: "Memastikan follow-up lead terotomatisasi dan transparan antar tim sales"
 *               solutionCategory:
 *                 type: object
 *                 required:
 *                   - name
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "CRM & Sales Pipeline Management"
 *                   keywords:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["crm", "pipeline", "sales tracking", "leads"]
 *               relevance:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 example: 0.95
 *               clarifyingQuestions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - "Berapa jumlah tim sales aktif saat ini?"
 *                   - "Apa kanal utama masuknya lead?"
 *     responses:
 *       201:
 *         description: Knowledge entry created successfully
 *       403:
 *         description: Forbidden - Admin role required
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

