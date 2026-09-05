const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const cache = require('../core/cache');
const { getSocketStats } = require('../core/socket');

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    }),
  ]);

// Liveness Check - implicit return
const liveness = (req, res) =>
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });

// Readiness Check - menggunakan implicit return dengan IIFE atau fungsi terpisah
const readiness = async (req, res) => {
  let healthy = true;
  const checks = { database: 'unknown', redis: 'unknown' };

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
    checks.database = 'ok';
  } catch (error) {
    console.error('Database check failed:', error.message);
    checks.database = 'error';
    healthy = false;
  }

  try {
    const client = cache.getClient?.();
    if (client && typeof client.ping === 'function') {
      const pong = await withTimeout(client.ping(), 1000);
      checks.redis = pong === 'PONG' || pong === 'pong' ? 'ok' : 'error';
    } else {
      checks.redis = 'disabled';
    }
  } catch (error) {
    console.error('Redis check failed:', error.message);
    checks.redis = 'error';
    healthy = false;
  }

  let socket = null;
  try {
    const stats = getSocketStats();
    socket = {
      activeSockets: stats?.activeSockets ?? 0,
      activeProfiles: stats?.activeProfiles ?? 0,
    };
  } catch (error) {
    console.error('Socket stats failed:', error.message);
    socket = { status: 'unavailable' };
  }

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'HEALTHY' : 'DEGRADED',
    checks,
    socket,
    timestamp: new Date().toISOString(),
  });
};

router.get('/', readiness);
router.get('/live', liveness);
router.get('/ready', readiness);

module.exports = router;