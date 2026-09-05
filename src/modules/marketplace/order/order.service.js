const crypto = require('crypto');
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const PaymentGateway = require('../../../core/payment/PaymentGateway');
const logger = require('../../../core/logger');
const config = require('../../../config/marketplace.config');
const { ensureBuyerParty } = require('../partyAutoCreate.service');

function generateInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${config.order.invoicePrefix}-${datePart}-${randomPart}`;
}

/**
 * Group cart items by seller party
 */
function groupBySeller(items) {
  const map = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const sellerId = item.product.partyId;
    if (!map.has(sellerId)) map.set(sellerId, []);
    map.get(sellerId).push(item);
  }
  return map;
}

async function createOrderFromCart(profileId, { shippingAddress, notes, _idempotencyKey }) {
  const cart = await prisma.cart.findUnique({
    where: { profileId },
    include: {
      items: {
        include: {
          product: { include: { variants: true, party: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw ApiError.badRequest('Cart kosong', ErrorCodes.CART_NOT_FOUND);
  }

  // Ensure buyer has a Party for escrow
  const sellerGroups = groupBySeller(cart.items);
  const sellerIds = Array.from(sellerGroups.keys());

  // Single seller mode (default MVP)
  if (!config.order.allowMultiSeller && sellerIds.length > 1) {
    throw ApiError.badRequest(
      'Checkout hanya bisa untuk produk dari 1 seller. Silakan pisah per seller.',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  let totalAmount = 0;
  const subOrdersData = [];
  const allOrderItems = [];

  const groups = Array.from(sellerGroups);

  for (let i = 0; i < groups.length; i++) {
    const [sellerPartyId, items] = groups[i];
    let subtotal = 0;
    const orderItemsData = [];

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const { product } = item;
      let unitPrice = product.price;
      let availableStock = product.stock;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant || !variant.isActive) {
          throw ApiError.badRequest('Variant tidak tersedia', ErrorCodes.NOT_FOUND);
        }
        unitPrice = variant.price ?? product.price;
        availableStock = variant.stock;
      }

      if (availableStock < item.quantity) {
        throw ApiError.badRequest(
          `Stok "${product.name}" tidak mencukupi. Tersedia: ${availableStock}`,
          ErrorCodes.INSUFFICIENT_STOCK
        );
      }

      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItemsData.push({
        productId: product.id,
        variantId: item.variantId,
        productName: product.name,
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });
    }

    totalAmount += subtotal;

    subOrdersData.push({
      sellerPartyId,
      subtotal,
      items: orderItemsData,
    });

    allOrderItems.push(...orderItemsData);
  }

  if (totalAmount > config.order.maxAmount) {
    throw ApiError.badRequest(
      `Total pesanan melebihi batas maksimal Rp ${config.order.maxAmount.toLocaleString('id-ID')}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  const invoiceNumber = generateInvoiceNumber();

  return prisma.$transaction(async (tx) => {
    // Atomic stock decrement
    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const { product } = item;
      const decrement = item.quantity;

      if (item.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: decrement } },
          data: { stock: { decrement } },
        });
        if (updated.count === 0) {
          throw ApiError.badRequest(
            `Stok "${product.name}" habis saat checkout`,
            ErrorCodes.INSUFFICIENT_STOCK
          );
        }
      } else {
        const updated = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: decrement } },
          data: { stock: { decrement } },
        });
        if (updated.count === 0) {
          throw ApiError.badRequest(
            `Stok "${product.name}" habis saat checkout`,
            ErrorCodes.INSUFFICIENT_STOCK
          );
        }
      }
    }

    // Create main order
    const order = await tx.order.create({
      data: {
        buyerId: profileId,
        totalAmount,
        currency: 'IDR',
        shippingAddress: shippingAddress || undefined,
        notes: notes || undefined,
        invoiceNumber,
        items: { create: allOrderItems },
      },
      include: { items: true },
    });

    // Create sub-orders
    for (let i = 0; i < subOrdersData.length; i++) {
      const sub = subOrdersData[i];

      const subOrder = await tx.orderSub.create({
        data: {
          orderId: order.id,
          sellerPartyId: sub.sellerPartyId,
          subtotal: sub.subtotal,
        },
      });

      // Link items to sub-order
      for (let j = 0; j < sub.items.length; j++) {
        const item = sub.items[j];

        await tx.orderItem.updateMany({
          where: { orderId: order.id, productId: item.productId, variantId: item.variantId || null },
          data: { subOrderId: subOrder.id },
        });
      }
    }

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Inventory logs
    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];

      await tx.inventoryLog.create({
        data: {
          inventoryBookId: (await ensureInventoryBook(item.product.partyId)).id,
          partyId: item.product.partyId,
          productId: item.product.id,
          variantId: item.variantId || null,
          type: 'OUT',
          quantity: item.quantity,
          stockBefore: item.product.stock,
          stockAfter: item.product.stock - item.quantity,
          referenceId: order.id,
          referenceType: 'ORDER',
          notes: `Penjualan via order ${invoiceNumber}`,
          createdBy: profileId,
        },
      });
    }

    return tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        subOrders: { include: { sellerParty: { select: { id: true, name: true } } } },
      },
    });
  });
}

async function ensureInventoryBook(partyId) {
  let book = await prisma.inventoryBook.findUnique({ where: { partyId } });
  if (!book) {
    book = await prisma.inventoryBook.create({ data: { partyId } });
  }
  return book;
}

async function createPayment(order, profile) {
  const gateway = PaymentGateway.getDefault();
  return gateway.createTransaction({
    orderId: order.invoiceNumber,
    grossAmount: order.totalAmount,
    customer: {
      name: profile.fullName,
      email: profile.user?.email,
      phone: profile.phone,
    },
    itemName: `Pesanan Marketplace #${order.invoiceNumber}`,
  });
}

async function handlePaymentWebhook(provider, payload) {
  const normalizedProvider = String(provider || 'MIDTRANS').toUpperCase();
  const gateway = PaymentGateway.of(normalizedProvider);
  const result = gateway.verifyWebhook(payload);

  if (!result.valid) {
    logger.warn('Marketplace webhook: invalid signature', { orderId: result.orderId });
    throw ApiError.forbidden('Invalid webhook signature', ErrorCodes.WEBHOOK_INVALID_SIGNATURE);
  }

  const order = await prisma.order.findUnique({
    where: { invoiceNumber: result.orderId },
    include: {
      buyer: { include: { user: true } },
      subOrders: { include: { sellerParty: true } },
      items: true,
    },
  });

  if (!order) {
    logger.warn('Marketplace webhook: unknown order', { orderId: result.orderId });
    return { acknowledged: true, reason: 'UNKNOWN_ORDER', orderId: result.orderId };
  }

  if (order.status !== 'PENDING_PAYMENT') {
    logger.info('Marketplace webhook: order already processed', {
      orderId: result.orderId, currentStatus: order.status,
    });
    return order;
  }

  if (result.status === 'PAID') {
    const buyerParty = await ensureBuyerParty(order.buyerId);

    await prisma.$transaction(async (tx) => {
      // Create escrow per sub-order
      for (let i = 0; i < order.subOrders.length; i++) {
        const item = order.subOrders[i];

        const escrow = await tx.escrowTransaction.create({
          data: {
            buyerPartyId: buyerParty.id,
            sellerPartyId: item.sellerPartyId,
            amount: item.subtotal,
            currency: order.currency,
            status: 'HELD',
            heldAt: new Date(),
          },
        });

        await tx.orderSub.update({
          where: { id: item.id },
          data: { status: 'PAID', escrowId: escrow.id },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });
    });

    // Cash entry: income for each seller
    for (let i = 0; i < order.subOrders.length; i++) {
      const item = order.subOrders[i];

      await ensureCashBook(item.sellerPartyId);
      await prisma.cashEntry.create({
        data: {
          cashBookId: (await prisma.cashBook.findUnique({ where: { partyId: item.sellerPartyId } })).id,
          partyId: item.sellerPartyId,
          type: 'INCOME',
          amount: item.subtotal,
          currency: order.currency,
          category: 'PENJUALAN',
          description: `Penjualan marketplace #${order.invoiceNumber}`,
          referenceId: order.id,
          referenceType: 'ORDER',
          status: 'CONFIRMED',
          createdBy: order.buyerId,
        },
      });
    }

    // Notifications
    await notifyOrderPaid(order);
  } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
    await restoreStock(order.id);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    await prisma.orderSub.updateMany({
      where: { orderId: order.id },
      data: { status: 'CANCELLED' },
    });
  }

  return order;
}

async function notifyOrderPaid(order) {
  try {
    await prisma.notification.create({
      data: {
        profileId: order.buyerId,
        type: 'ORDER_PAID',
        title: 'Pembayaran Berhasil',
        message: `Pesanan #${order.invoiceNumber} telah dibayar.`,
        data: { orderId: order.id, invoiceNumber: order.invoiceNumber },
      },
    });
  } catch (e) { logger.error('Notify buyer failed', { error: e.message }); }

  for (let i = 0; i < order.subOrders.length; i++) {
    const item = order.subOrders[i];

    try {
      const sellers = await prisma.businessRole.findMany({
        where: { partyId: item.sellerPartyId },
        select: { profileId: true },
      });

      for (let j = 0; j < sellers.length; j++) {
        const seller = sellers[j];

        await prisma.notification.create({
          data: {
            profileId: seller.profileId,
            type: 'ORDER_RECEIVED',
            title: 'Pesanan Baru Masuk',
            message: `Pesanan #${order.invoiceNumber} senilai Rp ${item.subtotal.toLocaleString('id-ID')}`,
            data: { orderId: order.id, subOrderId: item.id },
          },
        });
      }
    } catch (e) {
      logger.error('Notify seller failed', { error: e.message });
    }
  }
}

async function restoreStock(orderId) {
  return prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Reverse inventory log
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      await tx.inventoryLog.create({
        data: {
          inventoryBookId: (await ensureInventoryBook(product.partyId)).id,
          partyId: product.partyId,
          productId: item.productId,
          variantId: item.variantId || null,
          type: 'ADJUST',
          quantity: item.quantity,
          stockBefore: product.stock,
          stockAfter: product.stock + item.quantity,
          referenceId: orderId,
          referenceType: 'ORDER_CANCEL',
          notes: 'Pembatalan order — stok dikembalikan',
          createdBy: 'SYSTEM',
        },
      });
    }
  });
}

async function getOrder(orderId, profileId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { media: { where: { isPrimary: true }, take: 1 } } } } },
      subOrders: {
        include: {
          sellerParty: { select: { id: true, name: true, logoUrl: true } },
          items: true,
          escrow: true,
        },
      },
      buyer: { select: { id: true, fullName: true } },
      escrow: true,
    },
  });

  if (!order) throw ApiError.notFound('Order tidak ditemukan', ErrorCodes.ORDER_NOT_FOUND);

  const isBuyer = order.buyerId === profileId;
  const sellerPartyIds = order.subOrders.map((s) => s.sellerPartyId);
  const isSeller = sellerPartyIds.length > 0 && (await prisma.businessRole.count({
    where: { partyId: { in: sellerPartyIds }, profileId },
  })) > 0;

  if (!isBuyer && !isSeller) {
    throw ApiError.forbidden('Anda tidak berhak melihat order ini', ErrorCodes.ORDER_UNAUTHORIZED);
  }

  return { order, isBuyer, isSeller };
}

async function listMyOrders(profileId, { page = 1, limit = 20, status } = {}) {
  const skip = (page - 1) * limit;
  const where = { buyerId: profileId, ...(status && { status }) };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { include: { media: { where: { isPrimary: true }, take: 1 } } } } },
        subOrders: { include: { sellerParty: { select: { id: true, name: true, logoUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function listMySales(profileId, { page = 1, limit = 20, status } = {}) {
  const partyIds = (await prisma.businessRole.findMany({
    where: { profileId },
    select: { partyId: true },
  })).map((p) => p.partyId);

  if (partyIds.length === 0) return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };

  const skip = (page - 1) * limit;
  const where = {
    subOrders: { some: { sellerPartyId: { in: partyIds }, ...(status && { status }) } },
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        buyer: { select: { id: true, fullName: true } },
        subOrders: {
          where: { sellerPartyId: { in: partyIds } },
          include: { sellerParty: { select: { id: true, name: true } }, escrow: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updateSubOrderStatus(subOrderId, profileId, { status, _trackingNumber }) {
  const subOrder = await prisma.orderSub.findUnique({
    where: { id: subOrderId },
    include: { order: true, sellerParty: true },
  });

  if (!subOrder) throw ApiError.notFound('Sub-order tidak ditemukan', ErrorCodes.ORDER_NOT_FOUND);

  const isSeller = await prisma.businessRole.count({
    where: { partyId: subOrder.sellerPartyId, profileId },
  }) > 0;

  if (!isSeller) {
    throw ApiError.forbidden('Hanya seller yang bisa update status', ErrorCodes.ORDER_UNAUTHORIZED);
  }

  const validTransitions = {
    PAID: ['PROCESSING'],
    PROCESSING: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['COMPLETED'],
  };

  if (!validTransitions[subOrder.status]?.includes(status)) {
    throw ApiError.badRequest(
      `Tidak bisa ubah status dari ${subOrder.status} ke ${status}`,
      ErrorCodes.ORDER_INVALID_STATE
    );
  }

  const updateData = { status };
  if (status === 'SHIPPED') updateData.shippedAt = new Date();
  if (status === 'DELIVERED') updateData.deliveredAt = new Date();

  const updated = await prisma.orderSub.update({
    where: { id: subOrderId },
    data: updateData,
    include: { sellerParty: true, order: true },
  });

  // Notify buyer
  try {
    await prisma.notification.create({
      data: {
        profileId: subOrder.order.buyerId,
        type: 'ORDER_STATUS_CHANGED',
        title: 'Status Pesanan Diperbarui',
        message: `Pesanan #${subOrder.order.invoiceNumber} dari ${subOrder.sellerParty.name} sekarang: ${status}`,
        data: { orderId: subOrder.order.id, subOrderId, status },
      },
    });
  } catch (e) { logger.error('Notify failed', { error: e.message }); }

  return updated;
}

async function confirmDelivery(subOrderId, profileId) {
  const subOrder = await prisma.orderSub.findUnique({
    where: { id: subOrderId },
    include: { order: true, sellerParty: true, escrow: true },
  });

  if (!subOrder) throw ApiError.notFound('Sub-order tidak ditemukan', ErrorCodes.ORDER_NOT_FOUND);

  const isBuyer = subOrder.order.buyerId === profileId;
  if (!isBuyer) {
    throw ApiError.forbidden('Hanya buyer yang bisa konfirmasi', ErrorCodes.ORDER_UNAUTHORIZED);
  }

  if (subOrder.status !== 'DELIVERED') {
    throw ApiError.badRequest(
      `Status ${subOrder.status} tidak bisa dikonfirmasi. Harus DELIVERED.`,
      ErrorCodes.ORDER_INVALID_STATE
    );
  }

  if (subOrder.escrowId && subOrder.escrow?.status === 'HELD') {
    await prisma.escrowTransaction.update({
      where: { id: subOrder.escrowId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }

  const updated = await prisma.orderSub.update({
    where: { id: subOrderId },
    data: { status: 'COMPLETED' },
  });

  // Check if all sub-orders completed → complete main order
  const pendingSubs = await prisma.orderSub.count({
    where: { orderId: subOrder.orderId, status: { not: 'COMPLETED' } },
  });
  if (pendingSubs === 0) {
    await prisma.order.update({
      where: { id: subOrder.orderId },
      data: { status: 'COMPLETED' },
    });
  }

  // Notify seller
  try {
    const sellers = await prisma.businessRole.findMany({
      where: { partyId: subOrder.sellerPartyId },
      select: { profileId: true },
    });
    for (let i = 0; i < sellers.length; i++) {
      const item = sellers[i];

      await prisma.notification.create({
        data: {
          profileId: item.profileId,
          type: 'ORDER_COMPLETED',
          title: 'Pesanan Selesai',
          message: `Pesanan #${subOrder.order.invoiceNumber} dikonfirmasi diterima. Dana dilepas dari escrow.`,
          data: { orderId: subOrder.orderId, subOrderId },
        },
      });
    }
  } catch (e) { logger.error('Notify seller failed', { error: e.message }); }

  return updated;
}

async function ensureCashBook(partyId) {
  let book = await prisma.cashBook.findUnique({ where: { partyId } });
  if (!book) {
    book = await prisma.cashBook.create({ data: { partyId } });
  }
  return book;
}

module.exports = {
  createOrderFromCart,
  createPayment,
  handlePaymentWebhook,
  getOrder,
  listMyOrders,
  listMySales,
  updateSubOrderStatus,
  confirmDelivery,
  restoreStock,
  ensureCashBook,
  ensureInventoryBook,
};
