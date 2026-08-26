/**
 * @openapi
 * tags:
 *   name: Report
 *   description: User melapor Profile lain — ditinjau admin di /admin/reports
 *
 * /reports:
 *   post:
 *     tags: [Report]
 *     summary: Laporkan sebuah Profile (spam, penipuan, konten tidak pantas, dst)
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Report]
 *     summary: List laporan yang saya buat
 *     security: [{ bearerAuth: [] }]
 */
const router = require('express').Router();
const { createReport, listMyReports } = require('./report.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createReportSchema } = require('../../validations/report.validation');

router.post('/', requireAuth, validate(createReportSchema), createReport);
router.get('/', requireAuth, listMyReports);

module.exports = router;
