const prisma = require('../../config/prisma');
const { success, created } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const cache = require('../../core/cache');
const cacheConfig = require('../../config/cache.config');
const boostService = require('./boost.service');

const listPlans = asyncHandler(async (req, res) => {
  const plans = await cache.getOrSet(
    cacheConfig.keys.boostPlans,
    () => prisma.boostPlan.findMany({ orderBy: { priorityWeight: 'asc' } }),
    cacheConfig.ttl.boostPlans
  );
  return success(res, plans);
});

const checkout = asyncHandler(async (req, res) => {
  const { opportunityId } = req.params;
  const { planType } = req.body;

  const result = await boostService.checkout({
    opportunityId,
    profileId: req.profile.id,
    planType,
  });

  // Boost aktif mengubah ranking → invalidasi cache matching opportunity ini
  await cache.delByPattern(`matching:${opportunityId}:*`);

  if (result.free) {
    return success(res, result, 'Boost FREE diaktifkan');
  }
  return created(res, result, 'Checkout boost dibuat — arahkan user ke paymentUrl');
});

module.exports = { listPlans, checkout };
