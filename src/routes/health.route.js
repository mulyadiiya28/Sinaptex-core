const prisma = require('../config/prisma');
const cache = require('../core/cache');
const { getSocketStats } = require('../core/socket');

// Helper agar async check tidak menggantung terlalu lama
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
};

module.exports = async function healthCheck(req, res) {
  let healthy = true;
  const checks = { database: 'unknown', redis: 'unknown' };

  // 1. Cek Database dengan Timeout 2 detik
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  // 2. Cek Redis dengan Timeout 1 detik
  try {
    const client = cache.getClient && cache.getClient();
    if (client) {
      const pong = await withTimeout(client.ping(), 1000);
      checks.redis = (pong === 'PONG' || pong === 'pong') ? 'ok' : 'error';
    } else {
      checks.redis = 'disabled';
    }
  } catch {
    checks.redis = 'error';
  }

  // 3. Ringkasan Socket
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

  // Tetap kembalikan 200 agar platform TIDAK mengirim SIGTERM jika DB/Redis hanya butuh waktu sejenak untuk konek
  res.status(200).json({
    success: healthy,
    status: healthy ? 'UP' : 'DEGRADED',
    checks,
    socket,
    timestamp: new Date().toISOString(),
  });
};