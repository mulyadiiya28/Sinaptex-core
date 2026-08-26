/**
 * @openapi
 * tags:
 *   name: Content
 *   description: CMS ringan (MVP Phase 1) — halaman statis & FAQ. Publik hanya lihat yang PUBLISHED; kelola lewat /admin/content/*.
 *
 * /content/pages/{slug}:
 *   get:
 *     tags: [Content]
 *     summary: Ambil satu halaman statis (mis. "tentang-kami", "syarat-ketentuan") yang PUBLISHED
 *
 * /content/faq:
 *   get:
 *     tags: [Content]
 *     summary: List FAQ yang PUBLISHED, terurut sesuai `order`
 */
const router = require('express').Router();
const { getPublicPage, listPublicFaq } = require('./content.controller');
const validate = require('../../middlewares/validate.middleware');
const { slugParamSchema } = require('../../validations/content.validation');

router.get('/pages/:slug', validate(slugParamSchema), getPublicPage);
router.get('/faq', listPublicFaq);

module.exports = router;
