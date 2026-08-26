const router = require('express').Router();
const { getById, updateMe } = require('./profile.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { updateProfileSchema, idParamSchema } = require('../../validations/profile.validation');

router.get('/:id', requireAuth, validate(idParamSchema), getById);
router.patch('/me', requireAuth, validate(updateProfileSchema), updateMe);

module.exports = router;
