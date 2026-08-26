/**
 * @openapi
 * tags:
 *   name: Intent
 *   description: |
 *     Intent Engine (Phase 21) — pintu masuk paling depan, sebelum Business
 *     Intelligence maupun Matching Engine. Baca kalimat bebas user, putuskan
 *     rute secara deterministik: DIRECT_SEARCH (langsung Matching Engine) atau
 *     NEEDS_DIAGNOSIS (Decision Engine Phase 19 / Diagnosis Engine Phase 20).
 *     Kalau tidak yakin, jawabannya AMBIGUOUS — tidak pernah menebak.
 *
 * /intent:
 *   post:
 *     tags: [Intent]
 *     summary: Kirim kalimat bebas, dapat balasan yang sudah diklasifikasi & dirutekan otomatis
 *     description: Publik (opsional Bearer). Contoh body{"text":"penjualan saya turun"} atau {"text":"cari supplier kopi"}.
 *     responses:
 *       200: { description: "classification (category/subtype/matchedPattern) + hasil dari engine yang dituju" }
 */
const router = require('express').Router();
const { submitIntent } = require('./intent.controller');
const { optionalAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { submitIntentSchema } = require('../../validations/intent.validation');

router.post('/', optionalAuth, validate(submitIntentSchema), submitIntent);

module.exports = router;
