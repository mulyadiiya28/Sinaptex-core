/**
 * @openapi
 * tags:
 *   name: Party
 *   description: |
 *     Party (perusahaan/individu yang melakukan bisnis) — sebelumnya cuma bisa dibuat
 *     sekali lewat POST /auth/register. Modul ini melengkapi CRUD mandiri supaya satu
 *     Profile bisa punya lebih dari satu Party (mis. akun pribadi + beberapa perusahaan).
 *
 * /parties:
 *   post:
 *     tags: [Party]
 *     summary: Buat Party baru untuk Profile yang login
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Party]
 *     summary: List semua Party milik Profile yang login
 *     security: [{ bearerAuth: [] }]
 *
 * /parties/{id}:
 *   get:
 *     tags: [Party]
 *     summary: Detail Party (publik — dipakai frontend nampilkan profil di halaman Opportunity)
 *   patch:
 *     tags: [Party]
 *     summary: Update Party milik sendiri
 *     security: [{ bearerAuth: [] }]
 *
 * /parties/{id}/capabilities:
 *   post:
 *     tags: [Party]
 *     summary: Tambah Capability ke Party milik sendiri
 *     security: [{ bearerAuth: [] }]
 *
 * /parties/{id}/capabilities/{capabilityId}:
 *   delete:
 *     tags: [Party]
 *     summary: Hapus Capability dari Party milik sendiri
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const {
  createParty,
  listMyParties,
  getParty,
  updateParty,
  addCapability,
  removeCapability,
} = require('./party.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  createPartySchema,
  idParamSchema,
  updatePartySchema,
  addCapabilitySchema,
  removeCapabilitySchema,
} = require('../../validations/party.validation');

router.post('/', requireAuth, validate(createPartySchema), createParty);
router.get('/', requireAuth, listMyParties);
router.get('/:id', validate(idParamSchema), getParty);
router.patch('/:id', requireAuth, validate(updatePartySchema), updateParty);
router.post('/:id/capabilities', requireAuth, validate(addCapabilitySchema), addCapability);
router.delete('/:id/capabilities/:capabilityId', requireAuth, validate(removeCapabilitySchema), removeCapability);

module.exports = router;
