const prisma = require('../../config/prisma');
const { success, created } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const cache = require('../../core/cache');
const cacheConfig = require('../../config/cache.config');
const boostService = require('./boost.service');

const BOOST_PLANS_CACHE_KEY = 'boost-plans:all';

const listPlans = asyncHandler(async (req, res) => {
  const cached = await cache.get(BOOST_PLANS_CACHE_KEY);
  if (cached) return success(res, cached);

  const plans = await prisma.boostPlan.findMany({ orderBy: { priorityWeight: 'asc' } });
  await cache.set(BOOST_PLANS_CACHE_KEY, plans, cacheConfig.ttl.boostPlans);
  return success(res, plans);
});

/**
 * Checkout / aktivasi boost.
 * FREE → aktif langsung.
 * Berbayar → paymentUrl Midtrans Snap; jangan percaya paymentStatus dari client.
 */
const checkout = asyncHandler(async (req, res) => {
  const { opportunityId } = req.params;
  const { planType } = req.body;

  const result = await boostService.checkout({
    opportunityId,
    profileId: req.profile.id,
    planType,
  });

  if (result.free) {
    return success(res, result, 'Boost FREE diaktifkan');
  }
  return created(res, result, 'Checkout boost dibuat — arahkan user ke paymentUrl');
});

module.exports = { listPlans, checkout };
