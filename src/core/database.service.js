// src/core/database.service.js
const prismaModule = require('../config/prisma');

const getPrisma = () => prismaModule.prisma || prismaModule;

async function healthCheck() {
  const startTime = Date.now();
  const client = module.exports.prisma || getPrisma();
  await client.$queryRaw`SELECT 1`;
  const latencyMs = Date.now() - startTime;
  return { ok: true, latencyMs };
}

async function disconnectDatabase() {
  const client = module.exports.prisma || getPrisma();
  if (client && typeof client.$disconnect === 'function') {
    await client.$disconnect();
  }
}

module.exports = {
  prisma: getPrisma(),
  healthCheck,
  checkDatabaseHealth: healthCheck, // Alias untuk pengujian unit
  disconnectDatabase,
};