const router = require('express').Router();
const { createInvitation, listMyInvitations, respondInvitation } = require('./invitation.controller');
const { listMyDeals, updateDeal } = require('./deal.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  createInvitationSchema,
  respondInvitationSchema,
  updateDealSchema,
} = require('../../validations/invitation.validation');

// Invitations
router.post('/', requireAuth, validate(createInvitationSchema), createInvitation);
router.get('/me', requireAuth, listMyInvitations);
router.patch('/:id/respond', requireAuth, validate(respondInvitationSchema), respondInvitation);

// Deals (nested under the same "collaboration" domain)
router.get('/deals/me', requireAuth, listMyDeals);
router.patch('/deals/:id', requireAuth, validate(updateDealSchema), updateDeal);

module.exports = router;
