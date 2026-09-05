const prisma = require('../../src/config/prisma');
const { checkDatabaseHealth, disconnectDatabase } = require('../../src/core/database.service');

// Mock Prisma client singleton
jest.mock('../../src/config/prisma', () => ({
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
}));

describe('Database Utility Service (Prisma Client Singleton)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs health check query successfully', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const health = await checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('handles disconnect gracefully without throwing', async () => {
    prisma.$disconnect.mockResolvedValueOnce();

    await expect(disconnectDatabase()).resolves.not.toThrow();
    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});