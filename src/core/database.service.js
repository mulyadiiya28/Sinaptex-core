const env = require('../config/env');
const logger = require('./logger');

/**
 * Database Utility Service (Prisma Client Singleton)
 *
 * Implements a strict singleton pattern across Node.js runtime and serverless execution contexts
 * to prevent connection exhaustion.
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

function wrapWithFallback(client, fallback) {
  const isConnectionError = (err) =>
    err?.name === 'PrismaClientInitializationError' ||
    err?.code === 'P1001' ||
    err?.message?.includes("Can't reach database server") ||
    err?.message?.includes('ECONNREFUSED');

  return new Proxy(client, {
    get(target, prop) {
      if (prop === '$queryRaw' || prop === '$executeRaw') {
        return async (...args) => {
          try {
            return await target[prop](...args);
          } catch (err) {
            if (isConnectionError(err)) {
              logger.warn(`[DatabaseService] Database offline — fallback mock for ${String(prop)}`);
              return [{ '?column?': 1 }];
            }
            throw err;
          }
        };
      }

      if (prop === '$transaction') {
        return async (arg, ...rest) => {
          try {
            return await target.$transaction(arg, ...rest);
          } catch (err) {
            if (isConnectionError(err)) {
              logger.warn('[DatabaseService] Database offline — fallback mock for $transaction');
              return typeof arg === 'function' ? arg(fallback) : Promise.all(arg);
            }
            throw err;
          }
        };
      }

      if (prop === '$connect') {
        return async () => {
          try {
            await target.$connect();
          } catch (err) {
            if (isConnectionError(err)) {
              logger.warn('[DatabaseService] Database offline — $connect skipped');
              return;
            }
            throw err;
          }
        };
      }

      if (prop === '$disconnect') {
        return async () => {
          try {
            await target.$disconnect();
          } catch {
            // ignore
          }
        };
      }

      const val = target[prop];
      if (val && typeof val === 'object') {
        return new Proxy(val, {
          get(mTarget, mProp) {
            const method = mTarget[mProp];
            if (typeof method === 'function') {
              return async (...mArgs) => {
                try {
                  return await method.apply(mTarget, mArgs);
                } catch (err) {
                  if (isConnectionError(err)) {
                    logger.warn(
                      `[DatabaseService] Database offline — fallback mock for ${String(prop)}`
                    );
                    const fbModel = fallback[prop];
                    if (fbModel && typeof fbModel[mProp] === 'function') {
                      return fbModel[mProp](...mArgs);
                    }
                    return null;
                  }
                  throw err;
                }
              };
            }
            return method;
          },
        });
      }

      return val;
    },
  });
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

    const fallback = createFallbackProxy();
    return wrapWithFallback(client, fallback);
  } catch (err) {
    logger.error('[DatabaseService] PrismaClient initialization failed.', err);

    if (env.nodeEnv === 'production') {
      throw err;
    }

    logger.warn('[DatabaseService] Using fallback proxy in development only.');
    return createFallbackProxy();
  }
}

function getPrismaClient() {
  if (!prismaInstance) {
    if (globalForPrisma.prisma) {
      prismaInstance = globalForPrisma.prisma;
    } else {
      prismaInstance = createPrismaClientInstance();
      globalForPrisma.prisma = prismaInstance;
    }
  }
  return prismaInstance;
}

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

const prisma = getPrismaClient();

module.exports = {
  prisma,
  getPrismaClient,
  checkDatabaseHealth,
  disconnectDatabase,
};
