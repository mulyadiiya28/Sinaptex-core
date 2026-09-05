/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Sinkronisasi identitas Supabase Auth ke User + Profile lokal
 *
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Sinkron sesi Supabase (sign-up/sign-in) ke User + Profile lokal
 *     description: |
 *       Dipanggil sekali dari client setelah `supabase-js` sign-up/sign-in sukses.
 *       Token Supabase divalidasi (`verifySupabaseToken`), lalu User + Profile
 *       (+ opsional Party & BusinessRole) dibuat/disinkronkan di DB lokal.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName]
 *             properties:
 *               fullName: { type: string, minLength: 2, maxLength: 120 }
 *               phone: { type: string, minLength: 8, maxLength: 20 }
 *               bio: { type: string, maxLength: 500 }
 *               location: { type: string, maxLength: 120 }
 *               businessRoles:
 *                 type: array
 *                 items: { type: string, enum: [BUYER, SUPPLIER, INVESTOR, STARTUP, PARTNER] }
 *                 default: [BUYER]
 *               capabilityNames:
 *                 type: array
 *                 items: { type: string }
 *               party:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name: { type: string, minLength: 2, maxLength: 150 }
 *                   isCompany: { type: boolean, default: true }
 *                   categoryId: { type: string, format: uuid }
 *                   description: { type: string, maxLength: 1000 }
 *                   location: { type: string, maxLength: 120 }
 *                   npwp: { type: string, maxLength: 40 }
 *                   nib: { type: string, maxLength: 40 }
 *     responses:
 *       201: { description: User + Profile lokal dibuat/disinkronkan }
 *       400: { description: Validasi gagal }
 *       401: { description: Token Supabase tidak ada/invalid/expired }
 *       409: { description: User untuk supabaseId ini sudah terdaftar }
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Ambil User + Profile (dan relasi terkait) milik sesi yang login
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Data user yang login }
 *       401: { description: Token tidak ada/invalid/expired, atau belum register lokal }
 *       403: { description: Akun SUSPENDED/BANNED }
 */
const router = require('express').Router();
const { register, me } = require('./auth.controller');
const { requireAuth, verifySupabaseToken } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { registerSchema } = require('../../validations/auth.validation');

// Client already holds a Supabase session (from supabase-js sign up/in on the frontend).
router.post('/register', verifySupabaseToken, validate(registerSchema), register);
router.get('/me', requireAuth, me);

module.exports = router;
