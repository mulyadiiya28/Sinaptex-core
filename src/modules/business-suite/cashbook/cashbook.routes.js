const router = require('express').Router();
const { addEntry, listEntries, getSummary, deleteEntry } = require('./cashbook.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const validate = require('../../../middlewares/validate.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/cashbook/summary', requireAuth, getSummary);
router.get('/parties/:partyId/cashbook', requireAuth, listEntries);
router.post('/parties/:partyId/cashbook', requireAuth, strictLimiter, addEntry);
router.delete('/parties/:partyId/cashbook/:entryId', requireAuth, deleteEntry);

module.exports = router;
