const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');

// Lazy import to prevent circular dependency
async function checkIsMember(profileId) {
  const membershipService = require('../../membership/membership.service');
  return membershipService.hasActiveMembership(profileId);
}

const DEFAULTS = Object.freeze({
  freeMaxProducts: Number(process.env.MARKETPLACE_FREE_MAX_PRODUCTS || 3),
  memberMaxProducts: Number(process.env.MARKETPLACE_MEMBER_MAX_PRODUCTS || 100),
  freeCanSell: process.env.MARKETPLACE_FREE_CAN_SELL === 'true',
});

/**
 * Enforce that user has permission to sell (membership required unless overridden)
 */
async function enforceSellerPermission(profileId) {
  if (DEFAULTS.freeCanSell) return true;

  const isMember = await checkIsMember(profileId);
  if (!isMember) {
    throw ApiError.forbidden(
      'Anda perlu membership aktif untuk berjualan di marketplace.',
      ErrorCodes.SELLER_MEMBERSHIP_REQUIRED
    );
  }
}

/**
 * Count active products owned by any Party of the profile
 */
async function countActiveProducts(profileId) {
  return prisma.product.count({
    where: {
      isActive: true,
      party: { ownerId: profileId },
    },
  });
}

/**
 * Enforce product quota before create/update reactivation
 */
async function enforceProductQuota(profileId, { excludeProductId } = {}) {
  const isMember = await checkIsMember(profileId);
  const maxAllowed = isMember ? DEFAULTS.memberMaxProducts : DEFAULTS.freeMaxProducts;

  const where = {
    isActive: true,
    party: { ownerId: profileId },
    ...(excludeProductId && { id: { not: excludeProductId } }),
  };

  const currentCount = await prisma.product.count({ where });

  if (currentCount >= maxAllowed) {
    const userRoleText = isMember ? 'membership aktif' : 'non-member (free)';
    const upgradeAdvice = isMember
      ? 'Silakan nonaktifkan produk lain sebelum membuat yang baru.'
      : 'Tingkatkan ke Membership untuk membuat hingga 100 produk aktif.';

    throw ApiError.forbidden(
      `Batas produk aktif untuk akun ${userRoleText} adalah maksimal ${maxAllowed} item. ` +
        `Saat ini Anda sudah memiliki ${currentCount} produk aktif. ${upgradeAdvice}`,
      ErrorCodes.PRODUCT_QUOTA_EXCEEDED,
      { isMember, currentCount, maxAllowed }
    );
  }

  return { isMember, currentCount, maxAllowed, remaining: maxAllowed - currentCount };
}

/**
 * Verify that the profile owns the product via Party ownership
 */
async function assertProductOwner(productId, profileId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { party: true },
  });

  if (!product) {
    throw ApiError.notFound('Produk tidak ditemukan', ErrorCodes.PRODUCT_NOT_FOUND);
  }

  if (product.party.ownerId !== profileId) {
    throw ApiError.forbidden('Anda bukan pemilik produk ini', ErrorCodes.FORBIDDEN);
  }

  return product;
}

module.exports = {
  enforceSellerPermission,
  enforceProductQuota,
  assertProductOwner,
  countActiveProducts,
  DEFAULTS,
};
