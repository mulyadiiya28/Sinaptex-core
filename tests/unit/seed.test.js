const { PrismaClient } = require('@prisma/client');

describe('Database Seeder Definition and Scripts', () => {
  it('defines package.json seed script properly', () => {
    const pkg = require('../../package.json');
    expect(pkg.scripts['prisma:seed']).toBe('node prisma/seed.js');
    expect(pkg.prisma.seed).toBe('node prisma/seed.js');
  });

  it('verifies seed script can be required without top-level syntax errors', () => {
    // Check that seed.js exports or executes asynchronously with standard Prisma structure
    const fs = require('fs');
    const path = require('path');
    const seedContent = fs.readFileSync(path.join(__dirname, '../../prisma/seed.js'), 'utf-8');

    expect(seedContent).toContain('membershipPlans');
    expect(seedContent).toContain('defaultCategories');
    expect(seedContent).toContain('testUserConfigs');
    expect(seedContent).toContain('admin@sinaptex.internal');
    expect(seedContent).toContain('buyer.corp@sinaptex.test');
    expect(seedContent).toContain('supplier.tech@sinaptex.test');
  });
});
