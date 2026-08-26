const router = require('express').Router();
const { register, me } = require('./auth.controller');
const { requireAuth, verifySupabaseToken } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { registerSchema } = require('../../validations/auth.validation');

// Client already holds a Supabase session (from supabase-js sign up/in on the frontend).
router.post('/register', verifySupabaseToken, validate(registerSchema), register);
router.get('/me', requireAuth, me);

module.exports = router;
