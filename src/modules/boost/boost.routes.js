const router = require('express').Router();
const { listPlans, activateBoost } = require('./boost.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { activateBoostSchema } = require('../../validations/boost.validation');

router.get('/plans', listPlans);
router.post('/:opportunityId/activate', requireAuth, validate(activateBoostSchema), activateBoost);

module.exports = router;
