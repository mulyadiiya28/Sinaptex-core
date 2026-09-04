const router = require('express').Router();
const { create, list, get, update, remove } = require('./contact.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/contacts', requireAuth, list);
router.get('/parties/:partyId/contacts/:contactId', requireAuth, get);
router.post('/parties/:partyId/contacts', requireAuth, strictLimiter, create);
router.patch('/parties/:partyId/contacts/:contactId', requireAuth, update);
router.delete('/parties/:partyId/contacts/:contactId', requireAuth, remove);

module.exports = router;
