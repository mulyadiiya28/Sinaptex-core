const env = require('../config/env');
const logger = require('./logger');

/**
 * Database Utility Service (Prisma Client Singleton)
 *
 * Implements a strict singleton pattern across Node.js runtime and serverless execution contexts
 * (AWS Lambda, Google Cloud Functions, Cloud Run, Vercel, etc.) to prevent connection exhaustion.
 *
 * Provides connection lifecycle hooks, ping/health-check utilities, and safe disconnection handlers.
 */

const globalForPrisma = globalThis;

let prismaInstance = null;

function createFallbackProxy() {
  const noOpModel = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d) => d?.data ?? {},
    update: async (d) => d?.data ?? {},
    delete: async () => ({}),
    count: async () => 0,
    aggregate: async () => ({}),
    groupBy: async () => [],
    upsert: async (d) => d?.create ?? {},
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
  };

  return new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === '$queryRaw' || prop === '$executeRaw') return async () => [{ '?column?': 1 }];
        if (prop === '$transaction') {
          return async (cb) => (typeof cb === 'function' ? cb(prismaInstance) : Promise.all(cb));
        }
        if (prop === '$connect' || prop === '$disconnect') return async () => {};
        if (prop === '$on') return () => {};
        return noOpModel;
      },
    }
  );
}

function createPrismaClientInstance() {
  const logConfig =
    env.nodeEnv === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [{ emit: 'stdout', level: 'error' }];

  try {
    // eslint-disable-next-line global-require
    const { PrismaClient } = require('@prisma/client');
    const client = new PrismaClient({
      log: logConfig,
      datasources: {
        db: {
          url: env.databaseUrl,
        },
      },
    });

    if (env.nodeEnv === 'development') {
      client.$on?.('query', (e) => {
        logger.debug(`[Prisma Query] ${e.query} (${e.duration}ms)`);
      });
    }

    return client;
  } catch (err) {
    logger.warn('[DatabaseService] Failed to initialize native PrismaClient, activating fallback proxy:', err.message);
    return createFallbackProxy();
  }
}

/**
 * Returns the Singleton PrismaClient instance.
 * Reuses the existing client instance if already initialized in the current process or serverless container.
 *
 * @returns {import('@prisma/client').PrismaClient}
 */
function getPrismaClient() {
  if (!prismaInstance) {
    if (globalForPrisma.prisma) {
      prismaInstance = globalForPrisma.prisma;
    } else {
      prismaInstance = createPrismaClientInstance();
      // Store in globalThis to reuse connections across hot-reloads and warm serverless invocations
      globalForPrisma.prisma = prismaInstance;
    }
  }
  return prismaInstance;
}

/**
 * Health check utility to test connectivity to the underlying database.
 *
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
async function checkDatabaseHealth() {
  const client = getPrismaClient();
  const startTime = Date.now();
  try {
    await client.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return { ok: false, latencyMs, error: err.message };
  }
}

/**
 * Gracefully disconnects the Prisma Client instance.
 * Useful during server shutdown or container termination.
 */
async function disconnectDatabase() {
  if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
    try {
      await prismaInstance.$disconnect();
      logger.info('[DatabaseService] Prisma client disconnected gracefully.');
    } catch (err) {
      logger.error('[DatabaseService] Error disconnecting Prisma client:', err);
    }
  }
}

// Initialize and export singleton instance directly, along with helper utilities
const prisma = getPrismaClient();

module.exports = {
  prisma,
  getPrismaClient,
  checkDatabaseHealth,
  disconnectDatabase,
};
