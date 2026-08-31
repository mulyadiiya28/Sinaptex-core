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
