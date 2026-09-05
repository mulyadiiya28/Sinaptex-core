/**
 * @openapi
 * tags:
 *   name: Profiles
 *   description: Profile pengguna (individu/perusahaan) — data inti Party & progress
 *
 * /profiles/me:
 *   get:
 *     tags: [Profiles]
 *     summary: Ambil profile milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile yang login }
 *       401: { description: Token tidak ada/invalid }
 *   patch:
 *     tags: [Profiles]
 *     summary: Update profile milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, minLength: 2, maxLength: 120 }
 *               bio: { type: string, maxLength: 500 }
 *               location: { type: string, maxLength: 120 }
 *               phone: { type: string, minLength: 5, maxLength: 30 }
 *               avatarUrl: { type: string, format: uri, maxLength: 500 }
 *               profileType: { type: string, enum: [INDIVIDUAL, COMPANY] }
 *     responses:
 *       200: { description: Profile diperbarui }
 *       400: { description: Validasi gagal }
 *       401: { description: Token tidak ada/invalid }
 *
 * /profiles/me/progress:
 *   get:
 *     tags: [Profiles]
 *     summary: Kelengkapan profile (progress onboarding, checklist verifikasi, dst)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Ringkasan progress profile }
 *       401: { description: Token tidak ada/invalid }
 *
 * /profiles/me/portfolio:
 *   post:
 *     tags: [Profiles]
 *     summary: Upload media portofolio (multipart, field "file") ke Cloudinary
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Media portofolio terupload }
 *       400: { description: File tidak valid/tidak ada }
 *       401: { description: Token tidak ada/invalid }
 *
 * /profiles/me/portfolio/{mediaId}:
 *   delete:
 *     tags: [Profiles]
 *     summary: Hapus satu media portofolio milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Media dihapus }
 *       404: { description: Media tidak ditemukan / bukan milik sendiri }
 *
 * /profiles/{id}:
 *   get:
 *     tags: [Profiles]
 *     summary: Detail profile berdasarkan id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Detail profile + party + capability }
 *       401: { description: Token tidak ada/invalid }
 *       404: { description: Profile tidak ditemukan }
 */
const router = require('express').Router();
const {
  getMe,
  getMyProgress,
  getById,
  updateMe,
  uploadPortfolioMedia,
  deletePortfolioMedia,
} = require('./profile.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const {
  updateProfileSchema,
  idParamSchema,
  mediaParamSchema,
} = require('../../validations/profile.validation');

// Current user profile endpoints (must come before /:id)
router.get('/me', requireAuth, getMe);
router.get('/me/progress', requireAuth, getMyProgress);
router.patch('/me', requireAuth, validate(updateProfileSchema), updateMe);
router.post('/me/portfolio', requireAuth, upload.single('file'), uploadPortfolioMedia);
router.delete('/me/portfolio/:mediaId', requireAuth, validate(mediaParamSchema), deletePortfolioMedia);

// Public / specified profile by id
router.get('/:id', requireAuth, validate(idParamSchema), getById);

module.exports = router;
