/**
 * @openapi
 * tags:
 *   name: Report
 *   description: User melapor Profile lain — ditinjau admin di /admin/reports
 */
const router = require('express').Router();
const { createReport, listMyReports } = require('./report.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { reportLimiter } = require('../../middlewares/rateLimit.middleware');
const { createReportSchema } = require('../../validations/report.validation');

router.post('/', requireAuth, reportLimiter, validate(createReportSchema), createReport);
router.get('/', requireAuth, listMyReports);

module.exports = router;
