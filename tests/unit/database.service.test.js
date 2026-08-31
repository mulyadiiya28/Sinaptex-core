const { getPrismaClient, checkDatabaseHealth, disconnectDatabase } = require('../../src/core/database.service');

describe('Database Utility Service (Prisma Client Singleton)', () => {
  it('returns the same singleton instance on repeated calls', () => {
    const client1 = getPrismaClient();
    const client2 = getPrismaClient();

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    expect(client1).toBe(client2);
  });

  it('performs health check query successfully', async () => {
    const health = await checkDatabaseHealth();
    expect(health).toHaveProperty('ok');
    expect(typeof health.latencyMs).toBe('number');
  });

  it('handles disconnect gracefully without throwing', async () => {
    await expect(disconnectDatabase()).resolves.not.toThrow();
  });
});
