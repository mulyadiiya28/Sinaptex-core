/**
 * @openapi
 * tags:
 *   name: Marketplace — Orders
 *   description: Order & checkout marketplace (v2 multi-seller)
 */
const router = require('express').Router();
const {
  checkout,
  getOrder,
  listMyOrders,
  listMySales,
  updateSubStatus,
  confirmDelivery,
} = require('./order.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const validate = require('../../../middlewares/validate.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');
const {
  createOrderSchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} = require('../../../validations/marketplace.validation');

router.post('/checkout', requireAuth, strictLimiter, validate(createOrderSchema), checkout);
router.get('/my/orders', requireAuth, listMyOrders);
router.get('/my/sales', requireAuth, listMySales);
router.get('/:id', requireAuth, validate(orderIdParamSchema), getOrder);
router.patch('/sub-orders/:subOrderId/status', requireAuth, validate(updateOrderStatusSchema), updateSubStatus);
router.post('/sub-orders/:subOrderId/confirm', requireAuth, validate(orderIdParamSchema), confirmDelivery);

module.exports = router;
