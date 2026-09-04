const router = require('express').Router();
const { addEntry, listEntries, getSummary, listAll } = require('./inventoryCard.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/inventory-cards', requireAuth, listAll);
router.get('/parties/:partyId/products/:productId/inventory-card', requireAuth, getSummary);
router.get('/parties/:partyId/products/:productId/inventory-card/entries', requireAuth, listEntries);
router.post('/parties/:partyId/products/:productId/inventory-card/entries', requireAuth, strictLimiter, addEntry);

module.exports = router;
