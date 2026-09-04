const router = require('express').Router();
const { addEntry, listEntries, getSummary } = require('./debtCard.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/contacts/:contactId/debt-card', requireAuth, getSummary);
router.get('/parties/:partyId/contacts/:contactId/debt-card/entries', requireAuth, listEntries);
router.post('/parties/:partyId/contacts/:contactId/debt-card/entries', requireAuth, strictLimiter, addEntry);

module.exports = router;
