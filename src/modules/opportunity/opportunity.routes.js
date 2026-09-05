/**
 * @openapi
 * tags:
 *   name: Opportunities
 *   description: Need/Offer yang dipublikasikan Party (STEP 3 flow)
 *
 * /opportunities:
 *   get:
 *     tags: [Opportunities]
 *     summary: List Opportunity publik (dengan filter, sort, search)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [NEED, OFFER] }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, ACTIVE, MATCHED, CLOSED, EXPIRED] }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: budgetMin
 *         schema: { type: number }
 *       - in: query
 *         name: budgetMax
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Cari di title & description (case-insensitive)
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, budgetMin, budgetMax, priority], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Daftar Opportunity dengan meta pagination }
 *   post:
 *     tags: [Opportunities]
 *     summary: Buat Opportunity baru (Need/Offer)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Opportunity dibuat }
 *       403: { description: Bukan pemilik Party }
 *
 * /opportunities/{id}:
 *   get:
 *     tags: [Opportunities]
 *     summary: Detail satu Opportunity
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Detail Opportunity }
 *       404: { description: Tidak ditemukan }
 *   patch:
 *     tags: [Opportunities]
 *     summary: Update Opportunity milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Opportunity diperbarui }
 *       403: { description: Bukan pemilik }
 *
 * /opportunities/{id}/media:
 *   post:
 *     tags: [Opportunities]
 *     summary: Upload media Opportunity (multipart, field "file") ke Cloudinary
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Media terupload }
 *       403: { description: Bukan pemilik Opportunity }
 *
 * /opportunities/{id}/close:
 *   post:
 *     tags: [Opportunities]
 *     summary: Tutup Opportunity milik sendiri (status -> CLOSED)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Opportunity ditutup }
 *       403: { description: Bukan pemilik }
 *       404: { description: Opportunity tidak ditemukan }
 *   patch:
 *     tags: [Opportunities]
 *     summary: Tutup Opportunity milik sendiri (alias PATCH dari endpoint POST /close)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Opportunity ditutup }
 *       403: { description: Bukan pemilik }
 *       404: { description: Opportunity tidak ditemukan }
 *
 * /opportunities/{id}/documents:
 *   get:
 *     tags: [Opportunities]
 *     summary: List dokumen pendukung Opportunity (invoice, sertifikat, dst)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Daftar dokumen }
 *       404: { description: Opportunity tidak ditemukan }
 *   post:
 *     tags: [Opportunities]
 *     summary: Upload dokumen pendukung Opportunity (multipart, field "file")
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *               documentType:
 *                 type: string
 *                 enum: [PROOF_OF_TRADE, QUALITY_CERTIFICATE, INVOICE, SPECIFICATION, SAMPLE_IMAGE, LEGAL_COMPLIANCE, OTHER]
 *                 default: PROOF_OF_TRADE
 *               title: { type: string, maxLength: 100 }
 *     responses:
 *       201: { description: Dokumen terupload }
 *       403: { description: Bukan pemilik Opportunity }
 *
 * /opportunities/{id}/documents/{documentId}:
 *   delete:
 *     tags: [Opportunities]
 *     summary: Hapus satu dokumen pendukung Opportunity
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Dokumen dihapus }
 *       403: { description: Bukan pemilik Opportunity }
 *       404: { description: Dokumen tidak ditemukan }
 */
const router = require('express').Router();
const {
  createOpportunity,
  listOpportunities,
  getOpportunity,
  updateOpportunity,
  closeOpportunity,
  uploadMedia,
  uploadOpportunityDocument,
  listOpportunityDocuments,
  deleteOpportunityDocument,
} = require('./opportunity.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const deprecated = require('../../middlewares/deprecated.middleware');
const {
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitySchema,
  idParamSchema,
  uploadDocumentSchema,
  documentParamSchema,
} = require('../../validations/opportunity.validation');

router.post('/', requireAuth, validate(createOpportunitySchema), createOpportunity);
router.get(
  '/',
  deprecated(
    'Untuk pencarian dari kalimat bebas, pakai POST /api/v1/intent — endpoint ini tetap aktif untuk pencarian terstruktur (filter/sort eksplisit).',
    '/api/v1/intent'
  ),
  validate(listOpportunitySchema),
  listOpportunities
);
router.get('/:id', validate(idParamSchema), getOpportunity);
router.patch('/:id', requireAuth, validate(updateOpportunitySchema), updateOpportunity);
router.post('/:id/close', requireAuth, validate(idParamSchema), closeOpportunity);
router.patch('/:id/close', requireAuth, validate(idParamSchema), closeOpportunity);
router.post('/:id/media', requireAuth, upload.single('file'), validate(idParamSchema), uploadMedia);
router.get('/:id/documents', validate(idParamSchema), listOpportunityDocuments);
router.post(
  '/:id/documents',
  requireAuth,
  upload.single('file'),
  validate(uploadDocumentSchema),
  uploadOpportunityDocument
);
router.delete(
  '/:id/documents/:documentId',
  requireAuth,
  validate(documentParamSchema),
  deleteOpportunityDocument
);

module.exports = router;

