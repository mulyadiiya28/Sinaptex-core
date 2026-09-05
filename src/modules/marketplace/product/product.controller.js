const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const productService = require('./product.service');
const productPolicyService = require('./productPolicy.service');

const createProduct = asyncHandler(async (req, res) => {
  await productPolicyService.enforceSellerPermission(req.profile.id);
  await productPolicyService.enforceProductQuota(req.profile.id);

  // Verify party ownership
  const party = await prisma.party.findFirst({
    where: { id: req.body.partyId, ownerId: req.profile.id },
  });
  if (!party) throw ApiError.forbidden('Anda bukan pemilik party ini');

  const product = await productService.createProduct(req.body, req.profile.id);
  return created(res, product, 'Produk berhasil dibuat');
});

const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProduct(req.params.id);
  return success(res, product);
});

const updateProduct = asyncHandler(async (req, res) => {
  const existing = await productPolicyService.assertProductOwner(req.params.id, req.profile.id);

  // If reactivating (isActive: true), check quota
  if (req.body.isActive === true && !existing.isActive) {
    await productPolicyService.enforceProductQuota(req.profile.id, { excludeProductId: existing.id });
  }

  const updated = await productService.updateProduct(req.params.id, req.body);
  return success(res, updated, 'Produk berhasil diperbarui');
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productPolicyService.assertProductOwner(req.params.id, req.profile.id);
  await productService.deleteProduct(req.params.id);
  return success(res, null, 'Produk berhasil dihapus');
});

const uploadMedia = asyncHandler(async (req, res) => {
  await productPolicyService.assertProductOwner(req.params.id, req.profile.id);
  if (!req.file) throw ApiError.badRequest('File wajib diupload (field: "file")');

  const media = await productService.uploadProductMedia(req.params.id, req.file);
  return created(res, media, 'Media berhasil diupload');
});

const deleteMedia = asyncHandler(async (req, res) => {
  await productPolicyService.assertProductOwner(req.params.id, req.profile.id);
  await productService.deleteProductMedia(req.params.mediaId, req.params.id);
  return success(res, null, 'Media berhasil dihapus');
});

const setPrimaryMedia = asyncHandler(async (req, res) => {
  await productPolicyService.assertProductOwner(req.params.id, req.profile.id);
  await productService.setPrimaryMedia(req.params.mediaId, req.params.id);
  return success(res, null, 'Media utama berhasil diubah');
});

const listMyProducts = asyncHandler(async (req, res) => {
  const result = await productService.listMyProducts(req.profile.id, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadMedia,
  deleteMedia,
  setPrimaryMedia,
  listMyProducts,
};
