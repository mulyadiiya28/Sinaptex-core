const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { toSkipTake, buildMeta } = require('../../shared/pagination');

const listFraudFlags = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.fraudFlag.findMany({
      where,
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
      ...toSkipTake({ page, limit }),
    }),
    prisma.fraudFlag.count({ where }),
  ]);

  return success(res, items, 'OK', 200, buildMeta({ page, limit, total }));
});

const getFraudFlag = asyncHandler(async (req, res) => {
  const flag = await prisma.fraudFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) throw ApiError.notFound('Fraud flag not found');

  const [partyA, partyB, deal] = await Promise.all([
    prisma.party.findUnique({ where: { id: flag.partyAId } }),
    prisma.party.findUnique({ where: { id: flag.partyBId } }),
    flag.dealId ? prisma.deal.findUnique({ where: { id: flag.dealId } }) : null,
  ]);

  return success(res, { ...flag, partyA, partyB, deal });
});

// Admin decides: CONFIRMED (fraud is real — keep Deal blocked/reversed manually if needed)
// or DISMISSED (false positive — legitimate business relationship).
const reviewFraudFlag = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const flag = await prisma.fraudFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) throw ApiError.notFound('Fraud flag not found');
  if (flag.status !== 'PENDING_REVIEW') {
    throw ApiError.conflict(`Fraud flag already ${flag.status}`);
  }

  const updated = await prisma.fraudFlag.update({
    where: { id: flag.id },
    data: {
      status,
      reviewedBy: req.profile.id,
      reviewedAt: new Date(),
      details: note ? [...flag.details, { adminNote: note }] : flag.details,
    },
  });

  // Dismissing a flag as false-positive removes any auto-cached relationship
  // that was based purely on this incident type, so future matching isn't blocked.
  if (status === 'DISMISSED') {
    await prisma.partyRelationship
      .deleteMany({
        where: {
          OR: [
            { partyAId: flag.partyAId, partyBId: flag.partyBId },
            { partyAId: flag.partyBId, partyBId: flag.partyAId },
          ],
          type: 'SUSPECTED_COLLUSION',
        },
      })
      .catch(() => null);
  }

  return success(res, updated, `Fraud flag ${status.toLowerCase()}`);
});

module.exports = { listFraudFlags, getFraudFlag, reviewFraudFlag };
