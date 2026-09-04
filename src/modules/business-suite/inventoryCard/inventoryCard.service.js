const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');

async function getOrCreateCard(partyId, productId, variantId = null) {
  let card = await prisma.inventoryCard.findUnique({
    where: { partyId_productId_variantId: { partyId, productId, variantId } },
  });
  if (!card) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    card = await prisma.inventoryCard.create({
      data: {
        partyId,
        productId,
        variantId,
        openingStock: product?.stock || 0,
        currentStock: product?.stock || 0,
      },
    });
  }
  return card;
}

async function addEntry(data) {
  const { partyId, productId, variantId, type, description, referenceNo, referenceType, referenceId, qty, unitCost, createdBy } = data;

  return prisma.$transaction(async (tx) => {
    const card = await getOrCreateCard(partyId, productId, variantId);
    let stockAfter = card.currentStock;

    if (type === 'IN') stockAfter += qty;
    else if (type === 'OUT') stockAfter -= qty;
    else if (type === 'ADJUST') stockAfter = qty;

    const entry = await tx.inventoryCardEntry.create({
      data: {
        cardId: card.id,
        partyId,
        type,
        description,
        referenceNo,
        referenceType,
        referenceId,
        qty,
        unitCost,
        stockBefore: card.currentStock,
        stockAfter,
        createdBy,
      },
    });

    // Update card
    const updateData = {
      currentStock: stockAfter,
      lastMovementAt: new Date(),
    };
    if (type === 'IN') updateData.totalIn = { increment: qty };
    if (type === 'OUT') updateData.totalOut = { increment: qty };
    if (type === 'ADJUST') updateData.totalAdjust = { increment: Math.abs(qty - card.currentStock) };

    // Update avgUnitCost (simple moving average)
    if (type === 'IN' && unitCost) {
      const totalValue = (card.currentStock * (card.avgUnitCost || 0)) + (qty * unitCost);
      updateData.avgUnitCost = totalValue / stockAfter;
    }

    await tx.inventoryCard.update({ where: { id: card.id }, data: updateData });

    return entry;
  });
}

async function listEntries(partyId, productId, variantId, { page = 1, limit = 20 } = {}) {
  const card = await getOrCreateCard(partyId, productId, variantId);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.inventoryCardEntry.findMany({
      where: { cardId: card.id },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.inventoryCardEntry.count({ where: { cardId: card.id } }),
  ]);

  return { card, items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getCardSummary(partyId, productId, variantId) {
  const card = await getOrCreateCard(partyId, productId, variantId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, sku: true, price: true },
  });
  const variant = variantId ? await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { name: true, sku: true },
  }) : null;

  return {
    ...card,
    product,
    variant,
    inventoryValue: card.currentStock * (card.avgUnitCost || product?.price || 0),
  };
}

async function listAllCards(partyId, { page = 1, limit = 20, lowStock = false } = {}) {
  const skip = (page - 1) * limit;
  const where = { partyId };

  if (lowStock) {
    where.currentStock = { lte: 5 };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryCard.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, price: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { currentStock: 'asc' },
      skip,
      take: limit,
    }),
    prisma.inventoryCard.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

module.exports = { getOrCreateCard, addEntry, listEntries, getCardSummary, listAllCards };
