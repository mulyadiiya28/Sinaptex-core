const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const reviewService = require('./review.service');

const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview({
    productId: req.params.productId,
    reviewerId: req.profile.id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  return created(res, review, 'Review berhasil dibuat');
});

const listReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listProductReviews(req.params.productId, req.query);
  return success(res, result.items, 'OK', 200, { ...result.meta, stats: result.stats });
});

const updateReview = asyncHandler(async (req, res) => {
  const updated = await reviewService.updateReview(
    req.params.reviewId,
    req.profile.id,
    req.body
  );
  return success(res, updated, 'Review diperbarui');
});

const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.params.reviewId, req.profile.id);
  return success(res, null, 'Review dihapus');
});

module.exports = { createReview, listReviews, updateReview, deleteReview };
