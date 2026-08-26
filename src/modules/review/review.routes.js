const { z } = require('zod');
const router = require('express').Router();
const { createReview, listPartyReviews } = require('./review.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createReviewSchema } = require('../../validations/review.validation');

router.post('/deals/:dealId', requireAuth, validate(createReviewSchema), createReview);
router.get(
  '/profile/:profileId',
  validate({ params: z.object({ profileId: z.string().uuid() }) }),
  listPartyReviews
);

module.exports = router;
