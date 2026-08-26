const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const pricingService = require('./pricing.service');

const setPlanPrice = asyncHandler(async (req, res) => {
  const { price, currency } = req.body;
  const pricing = await pricingService.setPlanPrice({ planId: req.params.planId, price, currency });
  return created(res, pricing, 'Harga baru diaktifkan, harga lama otomatis diarsipkan (histori tetap utuh)');
});

const getPriceHistory = asyncHandler(async (req, res) => {
  const history = await pricingService.getPriceHistory(req.params.planId);
  return success(res, history);
});

module.exports = { setPlanPrice, getPriceHistory };
