const router = require('express').Router();
const { createReview, listReviews, updateReview, deleteReview } = require('./review.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/products/:productId/reviews', listReviews);
router.post('/products/:productId/reviews', requireAuth, strictLimiter, createReview);
router.patch('/reviews/:reviewId', requireAuth, updateReview);
router.delete('/reviews/:reviewId', requireAuth, deleteReview);

module.exports = router;
