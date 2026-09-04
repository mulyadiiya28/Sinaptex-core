const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const orderService = require('./order.service');

const checkout = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] || undefined;
  const order = await orderService.createOrderFromCart(req.profile.id, {
    ...req.body,
    idempotencyKey,
  });

  const payment = await orderService.createPayment(order, req.profile);

  return created(res, {
    order,
    paymentUrl: payment.paymentUrl,
    token: payment.token,
  }, 'Order dibuat — silakan lanjutkan pembayaran');
});

const getOrder = asyncHandler(async (req, res) => {
  const { order } = await orderService.getOrder(req.params.id, req.profile.id);
  return success(res, order);
});

const listMyOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listMyOrders(req.profile.id, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const listMySales = asyncHandler(async (req, res) => {
  const result = await orderService.listMySales(req.profile.id, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const updateSubStatus = asyncHandler(async (req, res) => {
  const updated = await orderService.updateSubOrderStatus(
    req.params.subOrderId,
    req.profile.id,
    req.body
  );
  return success(res, updated, 'Status sub-order diperbarui');
});

const confirmDelivery = asyncHandler(async (req, res) => {
  const updated = await orderService.confirmDelivery(req.params.subOrderId, req.profile.id);
  return success(res, updated, 'Pesanan dikonfirmasi diterima — escrow dilepas');
});

module.exports = {
  checkout,
  getOrder,
  listMyOrders,
  listMySales,
  updateSubStatus,
  confirmDelivery,
};
