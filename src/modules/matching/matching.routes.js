/**
 * @openapi
 * /matching/{opportunityId}/run:
 *   get:
 *     tags: [Matching]
 *     summary: Jalankan Matching Engine + Ranking Engine untuk sebuah Opportunity
 *     description: |
 *       Hard filter (tipe berlawanan, kategori, visibility, status) lalu scoring
 *       tertimbang (capability, location, budget, tags, text similarity, priority),
 *       digabung dengan Ranking Engine (reputation/response/completion/activity/
 *       verification/boost, dikurangi penalty). Match yang dihasilkan di-persist
 *       supaya bisa dirujuk oleh POST /invitations.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: opportunityId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200: { description: Daftar kandidat terurut beserta matchScore/finalScore + breakdown }
 *       404: { description: Opportunity tidak ditemukan }
 */
const router = require('express').Router();
const { runMatching } = require('./matching.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { runMatchSchema } = require('../../validations/invitation.validation');

// STEP 5+6+7: run matching+ranking for an Opportunity, return ranked results with breakdown
router.get('/:opportunityId/run', requireAuth, validate(runMatchSchema), runMatching);

module.exports = router;
