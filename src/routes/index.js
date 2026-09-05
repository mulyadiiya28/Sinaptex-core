const router = require('express').Router();
const v1Routes = require('./v1');

// Health check stays unversioned
router.use('/health', require('./health.route'));

// Versioned business API
router.use('/v1', v1Routes);

// Backward-compat alias - mount ke root TANPA override v1
// Gunakan path prefix yang spesifik, bukan catch-all
router.use('/api', v1Routes);  

module.exports = router;