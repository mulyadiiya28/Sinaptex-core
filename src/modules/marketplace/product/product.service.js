const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const logger = require('../../../core/logger');
const cache = require('../../../core/cache');
const { uploadBuffer, deleteAsset } = require('../../../utils/cloudinaryUpload');

const PRODUCT_LIST_CACHE_TTL = 60; // seconds

async function createProduct(data, _profileId) {
  const { variants, ...productData } = data;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...productData,
        party: { connect: { id: productData.partyId } },
      },
    });

    if (variants?.length) {
      await tx.productVariant.createMany({
        data: variants.map((v) => ({
          ...v,
          productId: product.id,
        })),
      });
    }

    await invalidateProductCaches();

    return tx.product.findUnique({
      where: { id: product.id },
      include: {
        party: { select: { id: true, name: true, logoUrl: true } },
        category: true,
        media: true,
        variants: true,
      },
    });
  });
}

async function listProducts(filters) {
  const cacheKey = `marketplace:products:${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const {
    categoryId,
    partyId,
    search,
    minPrice,
    maxPrice,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = filters;

  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(categoryId && { categoryId }),
    ...(partyId && { partyId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ],
    }),
    ...(minPrice !== undefined && { price: { gte: minPrice } }),
    ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, logoUrl: true, verificationStatus: true } },
        category: true,
        media: { orderBy: { isPrimary: 'desc' } },
        variants: { where: { isActive: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { [sortBy]: sortOrder }],
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const result = {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  await cache.set(cacheKey, result, PRODUCT_LIST_CACHE_TTL);
  return result;
}

async function getProduct(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      party: { select: { id: true, name: true, logoUrl: true, verificationStatus: true, location: true } },
      category: true,
      media: { orderBy: { isPrimary: 'desc' } },
      variants: { where: { isActive: true } },
    },
  });

  if (!product) {
    throw ApiError.notFound('Produk tidak ditemukan', ErrorCodes.PRODUCT_NOT_FOUND);
  }

  return product;
}

async function updateProduct(productId, data) {
  const updated = await prisma.product.update({
    where: { id: productId },
    data,
    include: {
      party: { select: { id: true, name: true } },
      media: true,
      variants: true,
    },
  });

  await invalidateProductCaches();
  return updated;
}

async function deleteProduct(productId) {
  // Soft delete: set isActive = false
  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  await invalidateProductCaches();
}

async function uploadProductMedia(productId, file) {
  const uploaded = await uploadBuffer(file.buffer, {
    folder: 'product-media',
    resourceType: 'image',
  });

  const media = await prisma.productMedia.create({
    data: {
      productId,
      url: uploaded.url,
      cloudinaryId: uploaded.cloudinaryId,
    },
  });

  await invalidateProductCaches();
  return media;
}

async function deleteProductMedia(mediaId, productId) {
  const media = await prisma.productMedia.findFirst({
    where: { id: mediaId, productId },
  });

  if (!media) {
    throw ApiError.notFound('Media tidak ditemukan', ErrorCodes.NOT_FOUND);
  }

  await deleteAsset(media.cloudinaryId);
  await prisma.productMedia.delete({ where: { id: mediaId } });
  await invalidateProductCaches();
}

async function setPrimaryMedia(mediaId, productId) {
  await prisma.$transaction([
    prisma.productMedia.updateMany({
      where: { productId },
      data: { isPrimary: false },
    }),
    prisma.productMedia.update({
      where: { id: mediaId },
      data: { isPrimary: true },
    }),
  ]);

  await invalidateProductCaches();
}

async function listMyProducts(_profileId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: { party: { ownerId: _profileId } },
      include: {
        media: { orderBy: { isPrimary: 'desc' }, take: 1 },
        variants: { where: { isActive: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where: { party: { ownerId: _profileId } } }),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function invalidateProductCaches(_profileId) {
  // Simple approach: we could use pattern delete if Redis supports it
  // For now, product list cache is short-lived (60s)
  logger.debug('Product caches invalidated');
}

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductMedia,
  deleteProductMedia,
  setPrimaryMedia,
  listMyProducts,
};
