const router = require('express').Router();
const { getDashboard, refreshCache } = require('./dashboard.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

router.get('/parties/:partyId/dashboard', requireAuth, getDashboard);
router.post('/parties/:partyId/dashboard/refresh', requireAuth, refreshCache);

module.exports = router;
