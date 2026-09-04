/**
 * @openapi
 * tags:
 *   name: Marketplace — Products
 *   description: Katalog produk marketplace (CRUD + media)
 */
const router = require('express').Router();
const {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadMedia,
  deleteMedia,
  setPrimaryMedia,
  listMyProducts,
} = require('./product.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const validate = require('../../../middlewares/validate.middleware');
const upload = require('../../../middlewares/upload.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');
const {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductSchema,
} = require('../../../validations/marketplace.validation');

// Public
router.get('/', validate(listProductSchema), listProducts);
router.get('/:id', validate(productIdParamSchema), getProduct);

// Seller only
router.get('/my/products', requireAuth, validate(listProductSchema), listMyProducts);
router.post('/', requireAuth, strictLimiter, validate(createProductSchema), createProduct);
router.patch('/:id', requireAuth, strictLimiter, validate(updateProductSchema), updateProduct);
router.delete('/:id', requireAuth, strictLimiter, validate(productIdParamSchema), deleteProduct);

// Media
router.post('/:id/media', requireAuth, upload.single('file'), validate(productIdParamSchema), uploadMedia);
router.delete('/:id/media/:mediaId', requireAuth, validate(productIdParamSchema), deleteMedia);
router.patch('/:id/media/:mediaId/primary', requireAuth, validate(productIdParamSchema), setPrimaryMedia);

module.exports = router;
