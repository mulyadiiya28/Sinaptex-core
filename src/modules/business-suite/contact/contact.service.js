const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const config = require('../../../config/businessSuite.config');
const logger = require('../../../core/logger');
const { eventBus, EVENTS } = require('../../../core/eventBus');

async function createContact(data) {
  const { partyId, type } = data;

  // Check limit
  const count = await prisma.contact.count({ where: { partyId, type } });
  const limit = type === 'CUSTOMER' ? config.masterData.maxCustomersPerParty
    : type === 'SUPPLIER' ? config.masterData.maxSuppliersPerParty
    : type === 'DEBTOR' ? config.masterData.maxDebtorsPerParty
    : config.masterData.maxCreditorsPerParty;

  if (count >= limit) {
    throw ApiError.badRequest(`Batas maksimal ${type.toLowerCase()} tercapai (${limit})`, ErrorCodes.VALIDATION_ERROR);
  }

  // Auto-generate code if not provided
  if (!data.code) {
    const prefix = type === 'CUSTOMER' ? 'CUST' : type === 'SUPPLIER' ? 'SUP' : type === 'DEBTOR' ? 'DBT' : 'CRD';
    const nextNum = count + 1;
    data.code = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  const contact = await prisma.contact.create({ data });

  // Auto-create card if debtor/creditor
  if (type === 'DEBTOR') {
    await prisma.receivableCard.create({
      data: { partyId, contactId: contact.id, openingBalance: 0 },
    });
  } else if (type === 'CREDITOR') {
    await prisma.debtCard.create({
      data: { partyId, contactId: contact.id, openingBalance: 0 },
    });
  }

  eventBus.emit(EVENTS.CONTACT_CREATED, { partyId, contactId: contact.id, type });
  return contact;
}

async function listContacts(partyId, { type, status, search, page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const where = {
    partyId,
    ...(type && { type }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getContact(contactId, partyId) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, partyId },
    include: {
      receivableCards: true,
      debtCards: true,
      tasks: { where: { status: { not: 'DONE' } }, take: 5 },
    },
  });
  if (!contact) throw ApiError.notFound('Kontak tidak ditemukan', ErrorCodes.NOT_FOUND);
  return contact;
}

async function updateContact(contactId, partyId, data) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, partyId } });
  if (!contact) throw ApiError.notFound('Kontak tidak ditemukan', ErrorCodes.NOT_FOUND);

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data,
  });

  eventBus.emit(EVENTS.CONTACT_UPDATED, { partyId, contactId, type: updated.type });
  return updated;
}

async function deleteContact(contactId, partyId) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, partyId } });
  if (!contact) throw ApiError.notFound('Kontak tidak ditemukan', ErrorCodes.NOT_FOUND);

  await prisma.contact.delete({ where: { id: contactId } });
  eventBus.emit(EVENTS.CONTACT_DELETED, { partyId, contactId });
}

module.exports = { createContact, listContacts, getContact, updateContact, deleteContact };
