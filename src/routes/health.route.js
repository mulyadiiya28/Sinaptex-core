const prisma = require('../config/prisma');
const cache = require('../core/cache');
const { getSocketStats } = require('../core/socket');

module.exports = async function healthCheck(req, res) {
  let healthy = true;
  const checks = { database: 'unknown', redis: 'unknown' };

  // 1. Kritis: Cek Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  // 2. Opsional: Cek Redis/Cache (Simple Ping)
  try {
    const client = cache.getClient && cache.getClient();
    if (client) {
      const pong = await client.ping();
      checks.redis = (pong === 'PONG' || pong === 'pong') ? 'ok' : 'error';
    } else {
      checks.redis = 'disabled';
    }
  } catch {
    checks.redis = 'error';
  }

  // 3. Ringkasan Socket (Hanya metrik umum)
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

  // Respon JSON Sederhana
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'Sinaptex API is up' : 'Degraded',
    checks,
    socket,
    timestamp: new Date().toISOString(),
  });
};