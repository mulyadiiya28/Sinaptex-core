const prisma = require('../config/prisma');

module.exports = async function healthCheck(req, res) {
  const checks = { database: 'unknown' };
  let healthy = true;
  let errorCode = null;
  let errorName = null;
  let errorMessage = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    healthy = false;
    // Safe diagnostics only — never leak connection string / credentials
    errorName = err.name || null;
    errorCode = err.code || null;
    errorMessage = typeof err.message === 'string' ? err.message.slice(0, 200) : null;
  }

  const body = {
    success: healthy,
    message: healthy ? 'Sinaptex API is up' : 'Degraded',
    checks,
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    // Always return Prisma error code in production so ops can diagnose without logs
    if (errorCode) body.errorCode = errorCode;
    if (errorName) body.errorName = errorName;
    // Full message only outside production (may contain host info)
    if (process.env.NODE_ENV !== 'production' && errorMessage) {
      body.errorMessage = errorMessage;
    }
  }

  res.status(healthy ? 200 : 503).json(body);
};
