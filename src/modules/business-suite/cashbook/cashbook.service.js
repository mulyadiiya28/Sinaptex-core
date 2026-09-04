const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const logger = require('../../../core/logger');
const config = require('../../../config/businessSuite.config');

async function getOrCreateCashBook(partyId) {
  let book = await prisma.cashBook.findUnique({
    where: { partyId },
    include: { entries: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!book) {
    book = await prisma.cashBook.create({
      data: { partyId },
      include: { entries: true },
    });
  }

  return book;
}

async function addEntry(data) {
  if (!config.cashBook.enabled) {
    throw ApiError.badRequest('CashBook feature is disabled', ErrorCodes.FEATURE_DISABLED);
  }

  const { partyId, type, amount, category, description, referenceId, referenceType, createdBy } = data;

  if (!config.cashBook.categories.includes(category)) {
    throw ApiError.badRequest(
      `Kategori tidak valid. Pilihan: ${config.cashBook.categories.join(', ')}`,
      ErrorCodes.VALIDATION_ERROR
    );
  }

  const book = await getOrCreateCashBook(partyId);

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.cashEntry.create({
      data: {
        cashBookId: book.id,
        partyId,
        type,
        amount,
        currency: config.cashBook.defaultCurrency,
        category,
        description,
        referenceId,
        referenceType,
        status: 'CONFIRMED',
        createdBy,
      },
    });

    // Update balance
    const delta = type === 'INCOME' ? amount : -amount;
    await tx.cashBook.update({
      where: { id: book.id },
      data: { balance: { increment: delta } },
    });

    return created;
  });

  return entry;
}

async function listEntries(partyId, { page = 1, limit = 20, type, category, startDate, endDate } = {}) {
  const book = await getOrCreateCashBook(partyId);
  const skip = (page - 1) * limit;

  const where = {
    cashBookId: book.id,
    ...(type && { type }),
    ...(category && { category }),
    ...(startDate && endDate && {
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
    }),
  };

  const [items, total, summary] = await Promise.all([
    prisma.cashEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cashEntry.count({ where }),
    prisma.cashEntry.groupBy({
      by: ['type'],
      where: { cashBookId: book.id },
      _sum: { amount: true },
    }),
  ]);

  const income = summary.find((s) => s.type === 'INCOME')?._sum.amount || 0;
  const expense = summary.find((s) => s.type === 'EXPENSE')?._sum.amount || 0;

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { income, expense, balance: income - expense },
  };
}

async function getSummary(partyId) {
  const book = await getOrCreateCashBook(partyId);
  const summary = await prisma.cashEntry.groupBy({
    by: ['type'],
    where: { cashBookId: book.id },
    _sum: { amount: true },
  });

  const income = summary.find((s) => s.type === 'INCOME')?._sum.amount || 0;
  const expense = summary.find((s) => s.type === 'EXPENSE')?._sum.amount || 0;

  return {
    partyId,
    currency: book.currency,
    balance: book.balance,
    totalIncome: income,
    totalExpense: expense,
  };
}

async function deleteEntry(entryId, partyId, profileId) {
  const entry = await prisma.cashEntry.findFirst({
    where: { id: entryId, partyId },
  });

  if (!entry) throw ApiError.notFound('Entry tidak ditemukan', ErrorCodes.NOT_FOUND);

  // Only creator or party owner can delete
  const isOwner = await prisma.party.findFirst({
    where: { id: partyId, ownerId: profileId },
  });
  if (entry.createdBy !== profileId && !isOwner) {
    throw ApiError.forbidden('Anda tidak berhak menghapus entry ini');
  }

  await prisma.$transaction(async (tx) => {
    const delta = entry.type === 'INCOME' ? -entry.amount : entry.amount;
    await tx.cashBook.update({
      where: { id: entry.cashBookId },
      data: { balance: { increment: delta } },
    });
    await tx.cashEntry.delete({ where: { id: entryId } });
  });
}

module.exports = {
  getOrCreateCashBook,
  addEntry,
  listEntries,
  getSummary,
  deleteEntry,
};
