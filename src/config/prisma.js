const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Singleton pattern to avoid exhausting DB connections on hot-reload
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
