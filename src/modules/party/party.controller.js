const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const includeDefault = {
  category: true,
  capabilities: { include: { capability: true } },
  businessRoles: true,
  verifications: { select: { id: true, type: true, status: true } },
};

/** Profile bisa punya lebih dari satu Party (mis. Individual utama + beberapa Company). */
const createParty = asyncHandler(async (req, res) => {
  const { capabilityNames, businessRoles, ...data } = req.body;

  const party = await prisma.$transaction(async (tx) => {
    const created2 = await tx.party.create({ data: { ...data, ownerId: req.profile.id } });

    if (capabilityNames?.length) {
      for (const name of capabilityNames) {
        const capability = await tx.capability.upsert({ where: { name }, update: {}, create: { name } });
        await tx.partyCapability.create({ data: { partyId: created2.id, capabilityId: capability.id } });
      }
    }

    if (businessRoles?.length) {
      for (const role of businessRoles) {
        await tx.businessRole.create({ data: { profileId: req.profile.id, role, partyId: created2.id } });
      }
    }

    return tx.party.findUnique({ where: { id: created2.id }, include: includeDefault });
  });

  return created(res, party, 'Party created');
});

const listMyParties = asyncHandler(async (req, res) => {
  const parties = await prisma.party.findMany({
    where: { ownerId: req.profile.id },
    include: includeDefault,
    orderBy: { createdAt: 'desc' },
  });
  return success(res, parties);
});

/** Publik — dipakai frontend nampilin profil Party di halaman Opportunity/Marketplace. */
const getParty = asyncHandler(async (req, res) => {
  const party = await prisma.party.findUnique({ where: { id: req.params.id }, include: includeDefault });
  if (!party) throw ApiError.notFound('Party not found');
  return success(res, party);
});

const updateParty = asyncHandler(async (req, res) => {
  const existing = await prisma.party.findFirst({ where: { id: req.params.id, ownerId: req.profile.id } });
  if (!existing) throw ApiError.forbidden('You do not own this party');

  const updated = await prisma.party.update({
    where: { id: req.params.id },
    data: req.body,
    include: includeDefault,
  });
  return success(res, updated, 'Party updated');
});

const addCapability = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const party = await prisma.party.findFirst({ where: { id: req.params.id, ownerId: req.profile.id } });
  if (!party) throw ApiError.forbidden('You do not own this party');

  const capability = await prisma.capability.upsert({ where: { name }, update: {}, create: { name } });
  await prisma.partyCapability
    .create({ data: { partyId: party.id, capabilityId: capability.id } })
    .catch(() => null); // sudah ada -> abaikan diam-diam, idempotent

  const updated = await prisma.party.findUnique({ where: { id: party.id }, include: includeDefault });
  return success(res, updated, 'Capability added');
});

const removeCapability = asyncHandler(async (req, res) => {
  const party = await prisma.party.findFirst({ where: { id: req.params.id, ownerId: req.profile.id } });
  if (!party) throw ApiError.forbidden('You do not own this party');

  await prisma.partyCapability.deleteMany({
    where: { partyId: party.id, capabilityId: req.params.capabilityId },
  });
  return success(res, null, 'Capability removed');
});

module.exports = { createParty, listMyParties, getParty, updateParty, addCapability, removeCapability };
