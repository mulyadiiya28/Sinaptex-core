const { success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('./dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await service.getDashboard(req.params.partyId, req.query);
  return success(res, dashboard);
});

const refreshCache = asyncHandler(async (req, res) => {
  await service.refreshDashboardCache(req.params.partyId);
  return success(res, null, 'Dashboard cache diperbarui');
});

module.exports = { getDashboard, refreshCache };
