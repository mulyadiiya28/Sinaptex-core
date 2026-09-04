/**
 * @openapi
 * tags:
 *   name: Marketplace — Cart
 *   description: Keranjang belanja buyer
 */
const router = require('express').Router();
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} = require('./cart.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const validate = require('../../../middlewares/validate.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');
const {
  addCartItemSchema,
  updateCartItemSchema,
  cartItemIdSchema,
} = require('../../../validations/marketplace.validation');

router.get('/', requireAuth, getCart);
router.post('/items', requireAuth, strictLimiter, validate(addCartItemSchema), addItem);
router.patch('/items/:itemId', requireAuth, validate(updateCartItemSchema), updateItem);
router.delete('/items/:itemId', requireAuth, validate(cartItemIdSchema), removeItem);
router.delete('/', requireAuth, clearCart);

module.exports = router;
