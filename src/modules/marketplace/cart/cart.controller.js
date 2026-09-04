const { success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const cartService = require('./cart.service');

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getOrCreateCart(req.profile.id);
  return success(res, cart);
});

const addItem = asyncHandler(async (req, res) => {
  const result = await cartService.addItem(req.profile.id, req.body);
  return success(res, result.item, result.action === 'CREATED' ? 'Item ditambahkan ke cart' : 'Qty diperbarui');
});

const updateItem = asyncHandler(async (req, res) => {
  const result = await cartService.updateItem(req.profile.id, req.params.itemId, req.body);
  return success(res, result.item || null, result.action === 'DELETED' ? 'Item dihapus' : 'Qty diperbarui');
});

const removeItem = asyncHandler(async (req, res) => {
  await cartService.removeItem(req.profile.id, req.params.itemId);
  return success(res, null, 'Item dihapus dari cart');
});

const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(req.profile.id);
  return success(res, null, 'Cart dikosongkan');
});

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
