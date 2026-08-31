/**
 * @openapi
 * tags:
 *   name: Matching
 *   description: Automated opportunity matching & ranking engine (Phase 5, 6, 7)
 *
 * components:
 *   schemas:
 *     MatchScoreBreakdown:
 *       type: object
 *       properties:
 *         capability:
 *           type: number
 *           description: Capability overlap score (0-100)
 *           example: 85.5
 *         location:
 *           type: number
 *           description: Geographical proximity score (0-100)
 *           example: 90
 *         budget:
 *           type: number
 *           description: Budget compatibility score (0-100)
 *           example: 100
 *         tags:
 *           type: number
 *           description: Tag similarity score (0-100)
 *           example: 75
 *         textSimilarity:
 *           type: number
 *           description: Title and description semantic similarity score (0-100)
 *           example: 80.2
 *         priority:
 *           type: number
 *           description: Urgency match score (0-100)
 *           example: 70
 *
 *     RankingScoreBreakdown:
 *       type: object
 *       properties:
 *         reputation:
 *           type: number
 *           description: Historical review & deal reputation score (0-100)
 *           example: 95
 *         response:
 *           type: number
 *           description: Response time and message velocity score (0-100)
 *           example: 88
 *         completion:
 *           type: number
 *           description: Deal completion rate score (0-100)
 *           example: 92
 *         activity:
 *           type: number
 *           description: Recent login and interaction activity score (0-100)
 *           example: 80
 *         verification:
 *           type: number
 *           description: Identity and business legal verification score (0-100)
 *           example: 100
 *         boost:
 *           type: number
 *           description: Priority boost package weight (0-100)
 *           example: 25
 *         penalty:
 *           type: number
 *           description: Deductions from expired or cancelled deals
 *           example: 0
 *
 *     MatchResultItem:
 *       type: object
 *       properties:
 *         matchId:
 *           type: string
 *           format: uuid
 *           description: Unique persisted Match ID (referenced by invitations)
 *           example: "d3b07384-d113-4a4b-9c8e-28f01742f9a1"
 *         opportunity:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *               example: "c4a18293-e224-4b5c-8d9f-17e02833e8b2"
 *             title:
 *               type: string
 *               example: "Penyedia Bahan Baku Kopi Arabika Organik"
 *             type:
 *               type: string
 *               enum: [NEED, OFFER]
 *               example: "OFFER"
 *             location:
 *               type: string
 *               example: "Bandung, Jawa Barat"
 *             party:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                   example: "Koperasi Tani Makmur"
 *                 logoUrl:
 *                   type: string
 *                   nullable: true
 *                   example: "https://res.cloudinary.com/sinaptex/image/upload/v1/logos/koperasi.png"
 *                 verificationStatus:
 *                   type: string
 *                   enum: [UNVERIFIED, PENDING, VERIFIED, REJECTED]
 *                   example: "VERIFIED"
 *         matchScore:
 *           type: number
 *           description: Content and compatibility match score (0-100)
 *           example: 87.4
 *         finalScore:
 *           type: number
 *           description: Combined score after applying ranking weights, reputation, and boost (0-100)
 *           example: 91.2
 *         matchBreakdown:
 *           $ref: '#/components/schemas/MatchScoreBreakdown'
 *         rankingBreakdown:
 *           $ref: '#/components/schemas/RankingScoreBreakdown'
 *
 * /matching/{opportunityId}/run:
 *   get:
 *     tags: [Matching]
 *     summary: Execute matching and ranking engine for an Opportunity
 *     description: |
 *       Performs multi-stage matching for a given Need or Offer:
 *       1. **Hard Filter**: Filters candidates with opposite type (NEED ↔ OFFER), category compatibility, ACTIVE status, and cross-party fraud prevention (excluding identical profile owners or related business entities).
 *       2. **Content Scoring**: Computes weighted compatibility across capability overlap, location proximity, budget bounds, tags, text similarity, and priority.
 *       3. **Ranking Engine**: Evaluates party reputation, response speed, completion rates, activity metrics, verification level, and active boost priority, deducting penalties for deal cancellations or expirations.
 *       4. **Persistence**: Upserts match records in the database so that subsequent invitations can reference the unique `matchId`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: opportunityId
 *         required: true
 *         description: UUID of the source Opportunity (NEED or OFFER)
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Maximum number of ranked candidate matches to return (1-50, default 10)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Ranked candidate matches retrieved and persisted successfully
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
 *                   example: "Found 3 ranked candidates"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MatchResultItem'
 *       400:
 *         description: Validation error in request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "VALIDATION_ERROR"
 *                 message:
 *                   type: string
 *                   example: "Invalid UUID format for opportunityId"
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "UNAUTHORIZED"
 *                 message:
 *                   type: string
 *                   example: "Bearer token required"
 *       404:
 *         description: Opportunity not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "NOT_FOUND"
 *                 message:
 *                   type: string
 *                   example: "Opportunity not found"
 */
const router = require('express').Router();
const { runMatching } = require('./matching.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { runMatchSchema } = require('../../validations/invitation.validation');

// STEP 5+6+7: run matching+ranking for an Opportunity, return ranked results with breakdown
router.get('/:opportunityId/run', requireAuth, validate(runMatchSchema), runMatching);

module.exports = router;

