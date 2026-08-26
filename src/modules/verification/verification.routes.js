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
