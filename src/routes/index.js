const router = require('express').Router();
const v1Routes = require('./v1');

// Health check stays unversioned (infra/monitoring tooling shouldn't need to track API versions)
router.get('/health', require('./health.route'));

// Versioned business API — see docs/api-contract.md
router.use('/v1', v1Routes);

// Backward-compat alias: unversioned path mirrors v1 for now. Remove once
// all clients have migrated and a v2 is on the horizon.
router.use('/', v1Routes);

module.exports = router;
