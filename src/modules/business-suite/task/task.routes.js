const router = require('express').Router();
const { create, list, get, update, remove } = require('./task.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { strictLimiter } = require('../../../middlewares/rateLimit.middleware');

router.get('/parties/:partyId/tasks', requireAuth, list);
router.get('/parties/:partyId/tasks/:taskId', requireAuth, get);
router.post('/parties/:partyId/tasks', requireAuth, strictLimiter, create);
router.patch('/parties/:partyId/tasks/:taskId', requireAuth, update);
router.delete('/parties/:partyId/tasks/:taskId', requireAuth, remove);

module.exports = router;
