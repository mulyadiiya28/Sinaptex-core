const router = require('express').Router();
const { create, list, get, update, remove } = require('./agenda.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/agenda', requireAuth, list);
router.get('/parties/:partyId/agenda/:agendaId', requireAuth, get);
router.post('/parties/:partyId/agenda', requireAuth, strictLimiter, create);
router.patch('/parties/:partyId/agenda/:agendaId', requireAuth, update);
router.delete('/parties/:partyId/agenda/:agendaId', requireAuth, remove);

module.exports = router;
