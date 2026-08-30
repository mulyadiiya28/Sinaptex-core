const prisma = require('../config/prisma');

module.exports = async function healthCheck(req, res) {
  const checks = { database: 'unknown' };
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'Sinaptex API is up' : 'Degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
};
