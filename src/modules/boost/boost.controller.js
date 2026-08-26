const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const cache = require('../../core/cache');
const cacheConfig = require('../../config/cache.config');

const BOOST_PLANS_CACHE_KEY = 'boost-plans:all';

const listPlans = asyncHandler(async (req, res) => {
  const cached = await cache.get(BOOST_PLANS_CACHE_KEY);
  if (cached) return success(res, cached);

  const plans = await prisma.boostPlan.findMany({ orderBy: { priorityWeight: 'asc' } });
  await cache.set(BOOST_PLANS_CACHE_KEY, plans, cacheConfig.ttl.boostPlans);
  return success(res, plans);
});

// STEP 4: Boost Engine - attach a package (FREE/BASIC/PREMIUM/VIP) to an Opportunity
const activateBoost = asyncHandler(async (req, res) => {
  const { opportunityId } = req.params;
  const { planType, paymentStatus } = req.body;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { party: true },
  });
  if (!opportunity) throw ApiError.notFound('Opportunity not found');
  if (opportunity.party.ownerId !== req.profile.id) throw ApiError.forbidden();

  const plan = await prisma.boostPlan.findUnique({ where: { type: planType } });
  if (!plan) throw ApiError.notFound(`Boost plan ${planType} not configured. Run the seed script.`);

  const startAt = new Date();
  const expiredAt = new Date(startAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const boost = await prisma.opportunityBoost.upsert({
    where: { opportunityId },
    update: { planId: plan.id, priorityWeight: plan.priorityWeight, startAt, expiredAt, paymentStatus },
    create: {
      opportunityId,
      planId: plan.id,
      priorityWeight: plan.priorityWeight,
      startAt,
      expiredAt,
      paymentStatus,
    },
    include: { plan: true },
  });

  return success(res, boost, 'Boost activated');
});

module.exports = { listPlans, activateBoost };
