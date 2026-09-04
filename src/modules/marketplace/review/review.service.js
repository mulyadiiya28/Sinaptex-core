const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const config = require('../../../config/marketplace.config');

async function createReview(data) {
  if (!config.review.enabled) {
    throw ApiError.badRequest('Review feature is disabled', ErrorCodes.FEATURE_DISABLED);
  }

  const { productId, reviewerId, rating, comment } = data;

  if (rating < config.review.minRating || rating > config.review.maxRating) {
    throw ApiError.badRequest(
      `Rating harus antara ${config.review.minRating} - ${config.review.maxRating}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Check if reviewer has purchased the product (verified review)
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { buyerId: reviewerId, status: 'COMPLETED' },
    },
  });

  try {
    const review = await prisma.productReview.create({
      data: {
        productId,
        reviewerId,
        rating,
        comment,
        isVerified: !!hasPurchased,
      },
      include: {
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    return review;
  } catch (e) {
    if (e.code === 'P2002') {
      throw ApiError.badRequest('Anda sudah mereview produk ini', ErrorCodes.VALIDATION_ERROR);
    }
    throw e;
  }
}

async function listProductReviews(productId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const [items, total, stats] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, hidden: false },
      include: {
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productReview.count({ where: { productId, hidden: false } }),
    prisma.productReview.aggregate({
      where: { productId, hidden: false },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats: {
      average: stats._avg.rating || 0,
      count: stats._count.rating,
    },
  };
}

async function updateReview(reviewId, reviewerId, { rating, comment }) {
  const review = await prisma.productReview.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review tidak ditemukan', ErrorCodes.NOT_FOUND);
  if (review.reviewerId !== reviewerId) {
    throw ApiError.forbidden('Anda bukan pemilik review ini');
  }

  if (rating !== undefined && (rating < config.review.minRating || rating > config.review.maxRating)) {
    throw ApiError.badRequest(
      `Rating harus antara ${config.review.minRating} - ${config.review.maxRating}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  return prisma.productReview.update({
    where: { id: reviewId },
    data: { rating, comment },
    include: {
      reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });
}

async function deleteReview(reviewId, reviewerId) {
  const review = await prisma.productReview.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review tidak ditemukan', ErrorCodes.NOT_FOUND);
  if (review.reviewerId !== reviewerId) {
    throw ApiError.forbidden('Anda bukan pemilik review ini');
  }

  await prisma.productReview.delete({ where: { id: reviewId } });
}

module.exports = {
  createReview,
  listProductReviews,
  updateReview,
  deleteReview,
};
