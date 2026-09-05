const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const cache = require('../core/cache');
const { getSocketStats } = require('../core/socket');

// Helper dengan implisit return (arrow-body-style) dan parameter `ms` yang digunakan (no-unused-vars)
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    }),
  ]);

// Liveness Check (tanpa block statement `{}` agar memenuhi arrow-body-style)
const liveness = (req, res) =>
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });

// Readiness Check
const readiness = async (req, res) => {
  let healthy = true;
  const checks = { database: 'unknown', redis: 'unknown' };

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  try {
    const client = cache.getClient && cache.getClient();
    if (client) {
      const pong = await withTimeout(client.ping(), 1000);
      checks.redis = pong === 'PONG' || pong === 'pong' ? 'ok' : 'error';
    } else {
      checks.redis = 'disabled';
    }
  } catch {
    checks.redis = 'error';
  }

  let socket = null;
  try {
    const stats = getSocketStats();
    socket = {
      activeSockets: stats?.activeSockets ?? 0,
      activeProfiles: stats?.activeProfiles ?? 0,
    };
  } catch {
    socket = { status: 'unavailable' };
  }

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'HEALTHY' : 'DEGRADED',
    checks,
    socket,
    timestamp: new Date().toISOString(),
  });
};

router.get('/live', liveness);
router.get('/ready', readiness);

module.exports = router;