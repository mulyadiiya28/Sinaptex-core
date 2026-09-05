const prisma = require('../../../config/prisma');

async function getOrCreateCard(partyId, contactId) {
  let card = await prisma.debtCard.findUnique({
    where: { partyId_contactId: { partyId, contactId } },
  });
  if (!card) {
    card = await prisma.debtCard.create({
      data: { partyId, contactId, openingBalance: 0 },
    });
  }
  return card;
}

async function addEntry(data) {
  // eslint-disable-next-line max-len
  const { partyId, contactId, date, description, referenceNo, referenceType, referenceId, debit, credit, createdBy } = data;

  return prisma.$transaction(async (tx) => {
    const card = await getOrCreateCard(partyId, contactId);
    const newBalance = card.currentBalance + (credit || 0) - (debit || 0);

    const entry = await tx.debtCardEntry.create({
      data: {
        cardId: card.id,
        partyId,
        date: date ? new Date(date) : new Date(),
        description,
        referenceNo,
        referenceType,
        referenceId,
        debit: debit || 0,
        credit: credit || 0,
        balance: newBalance,
        createdBy,
      },
    });

    await tx.debtCard.update({
      where: { id: card.id },
      data: {
        totalDebit: { increment: debit || 0 },
        totalCredit: { increment: credit || 0 },
        currentBalance: newBalance,
        lastTransactionAt: new Date(),
      },
    });

    return entry;
  });
}

async function listEntries(partyId, contactId, { page = 1, limit = 20, startDate, endDate } = {}) {
  const card = await getOrCreateCard(partyId, contactId);
  const skip = (page - 1) * limit;
  const where = {
    cardId: card.id,
    ...(startDate && endDate && { date: { gte: new Date(startDate), lte: new Date(endDate) } }),
  };

  const [items, total] = await Promise.all([
    prisma.debtCardEntry.findMany({ where, orderBy: { date: 'desc' }, skip, take: limit }),
    prisma.debtCardEntry.count({ where }),
  ]);

  return { card, items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getCardSummary(partyId, contactId) {
  const card = await getOrCreateCard(partyId, contactId);
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { name: true, phone: true },
  });
  return { ...card, contact };
}

module.exports = { getOrCreateCard, addEntry, listEntries, getCardSummary };
