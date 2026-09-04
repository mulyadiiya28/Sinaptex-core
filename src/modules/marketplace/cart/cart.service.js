const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const logger = require('../../../core/logger');

async function getOrCreateCart(profileId) {
  let cart = await prisma.cart.findUnique({
    where: { profileId },
    include: {
      items: {
        include: {
          product: {
            include: {
              party: { select: { id: true, name: true } },
              media: { where: { isPrimary: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { profileId },
      include: {
        items: {
          include: {
            product: {
              include: {
                party: { select: { id: true, name: true } },
                media: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

async function addItem(profileId, { productId, variantId, quantity }) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });

  if (!product || !product.isActive) {
    throw ApiError.notFound('Produk tidak ditemukan atau tidak aktif', ErrorCodes.PRODUCT_NOT_FOUND);
  }

  // Check stock
  let availableStock = product.stock;
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant || !variant.isActive) {
      throw ApiError.notFound('Variant tidak ditemukan', ErrorCodes.NOT_FOUND);
    }
    availableStock = variant.stock;
  }

  if (availableStock < quantity) {
    throw ApiError.badRequest(
      `Stok tidak mencukup. Tersedia: ${availableStock}`,
      ErrorCodes.INSUFFICIENT_STOCK
    );
  }

  const cart = await getOrCreateCart(profileId);

  // Check if item already exists
  const existingItem = cart.items.find(
    (item) => item.productId === productId && item.variantId === (variantId || null)
  );

  if (existingItem) {
    const newQty = existingItem.quantity + quantity;
    if (availableStock < newQty) {
      throw ApiError.badRequest(
        `Stok tidak mencukup. Tersedia: ${availableStock}, di cart: ${existingItem.quantity}`,
        ErrorCodes.INSUFFICIENT_STOCK
      );
    }

    const updated = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQty },
      include: {
        product: {
          include: {
            party: { select: { id: true, name: true } },
            media: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    return { item: updated, action: 'UPDATED' };
  }

  const created = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      variantId: variantId || null,
      quantity,
    },
    include: {
      product: {
        include: {
          party: { select: { id: true, name: true } },
          media: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });

  return { item: created, action: 'CREATED' };
}

async function updateItem(profileId, itemId, { quantity }) {
  const cart = await getOrCreateCart(profileId);
  const item = cart.items.find((i) => i.id === itemId);

  if (!item) {
    throw ApiError.notFound('Item cart tidak ditemukan', ErrorCodes.CART_ITEM_NOT_FOUND);
  }

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
    return { action: 'DELETED' };
  }

  // Re-check stock
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: { variants: true },
  });

  let availableStock = product.stock;
  if (item.variantId) {
    const variant = product.variants.find((v) => v.id === item.variantId);
    availableStock = variant?.stock ?? 0;
  }

  if (availableStock < quantity) {
    throw ApiError.badRequest(
      `Stok tidak mencukup. Tersedia: ${availableStock}`,
      ErrorCodes.INSUFFICIENT_STOCK
    );
  }

  const updated = await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
    include: {
      product: {
        include: {
          party: { select: { id: true, name: true } },
          media: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });

  return { item: updated, action: 'UPDATED' };
}

async function removeItem(profileId, itemId) {
  const cart = await getOrCreateCart(profileId);
  const item = cart.items.find((i) => i.id === itemId);

  if (!item) {
    throw ApiError.notFound('Item cart tidak ditemukan', ErrorCodes.CART_ITEM_NOT_FOUND);
  }

  await prisma.cartItem.delete({ where: { id: itemId } });
  return { action: 'DELETED' };
}

async function clearCart(profileId) {
  const cart = await prisma.cart.findUnique({ where: { profileId } });
  if (!cart) return { action: 'NOOP' };

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return { action: 'CLEARED' };
}

module.exports = {
  getOrCreateCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
