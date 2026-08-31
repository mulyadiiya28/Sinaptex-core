/**
 * @openapi
 * tags:
 *   name: Intent
 *   description: Intent Engine — pintu masuk kalimat bebas (rate-limited)
 */
const router = require('express').Router();
const { submitIntent } = require('./intent.controller');
const { optionalAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { intentLimiter } = require('../../middlewares/rateLimit.middleware');
const { submitIntentSchema } = require('../../validations/intent.validation');

router.post('/', intentLimiter, optionalAuth, validate(submitIntentSchema), submitIntent);

module.exports = router;
