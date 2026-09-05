/**
 * @openapi
 * tags:
 *   name: Verification
 *   description: Dokumen KYC (KTP/NIB/NPWP/dst) untuk profile/party
 *
 * /verification-documents:
 *   post:
 *     tags: [Verification]
 *     summary: Upload dokumen verifikasi (multipart, field "file") ke Cloudinary
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, type]
 *             properties:
 *               file: { type: string, format: binary }
 *               type: { type: string, enum: [KTP, NIB, NPWP, SERTIFIKAT, LAINNYA] }
 *               partyId:
 *                 type: string
 *                 format: uuid
 *                 description: Opsional — jika kosong, dokumen dilekatkan ke profile pemanggil
 *     responses:
 *       201: { description: Dokumen terupload, status awal PENDING }
 *       400: { description: File/tipe dokumen tidak valid }
 *       401: { description: Token tidak ada/invalid }
 *
 * /verification-documents/me:
 *   get:
 *     tags: [Verification]
 *     summary: List dokumen verifikasi milik sendiri
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar dokumen beserta status VERIFIED/REJECTED/PENDING }
 *       401: { description: Token tidak ada/invalid }
 *
 * /verification-documents/{id}/review:
 *   patch:
 *     tags: [Verification]
 *     summary: Approve/reject dokumen verifikasi — role ADMIN
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [VERIFIED, REJECTED] }
 *               rejectReason:
 *                 type: string
 *                 maxLength: 300
 *                 description: Wajib diisi bila status REJECTED
 *     responses:
 *       200: { description: Status dokumen diperbarui }
 *       400: { description: rejectReason wajib diisi ketika status REJECTED }
 *       403: { description: Bukan role ADMIN }
 *       404: { description: Dokumen tidak ditemukan }
 */
const router = require('express').Router();
const { uploadDocument, listMyDocuments, reviewDocument } = require('./verification.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/upload.middleware');
const {
  uploadDocumentSchema,
  reviewDocumentSchema,
} = require('../../validations/verification.validation');

router.post(
  '/',
  requireAuth,
  upload.single('file'),
  validate(uploadDocumentSchema),
  uploadDocument
);
router.get('/me', requireAuth, listMyDocuments);
router.patch(
  '/:id/review',
  requireAuth,
  requireRole('ADMIN'),
  validate(reviewDocumentSchema),
  reviewDocument
);

module.exports = router;
