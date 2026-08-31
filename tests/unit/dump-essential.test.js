const fs = require('fs');
const path = require('path');
const {
  dumpEssentialTables,
  DEFAULT_TABLES,
  getTimestampString,
} = require('../../prisma/scripts/dump-essential');
const prisma = require('../../src/config/prisma');

jest.mock('../../src/config/prisma', () => ({
  user: {
    findMany: jest.fn(),
  },
  profile: {
    findMany: jest.fn(),
  },
  party: {
    findMany: jest.fn(),
  },
  opportunity: {
    findMany: jest.fn(),
  },
  membership: {
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Database Essential Tables Dump Utility', () => {
  const testOutDir = path.join(__dirname, '../temp_backups');

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it('generates a timestamp string matching YYYYMMDD_HHMMSS pattern', () => {
    const fixedDate = new Date('2026-08-31T14:30:45.000Z');
    const ts = getTimestampString(fixedDate);
    expect(ts).toBe('20260831_143045');
  });

  it('dumps users, profiles, parties, offers, needs, and memberships to JSON file', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'usr-1', email: 'test@example.com', supabaseId: 'sb-1', phone: '+628111', createdAt: new Date() },
    ]);
    prisma.profile.findMany.mockResolvedValue([
      { id: 'prof-1', userId: 'usr-1', fullName: 'Test User', reputationScore: 90 },
    ]);
    prisma.party.findMany.mockResolvedValue([
      { id: 'pty-1', ownerId: 'prof-1', name: 'Test Corp', isCompany: true },
    ]);
    prisma.opportunity.findMany.mockResolvedValue([
      { id: 'opp-1', partyId: 'pty-1', type: 'OFFER', title: 'Industrial CNC' },
      { id: 'opp-2', partyId: 'pty-1', type: 'NEED', title: 'Raw Steel Supply' },
    ]);
    prisma.membership.findMany.mockResolvedValue([
      { id: 'mem-1', profileId: 'prof-1', status: 'ACTIVE' },
    ]);

    const result = await dumpEssentialTables({
      outDir: testOutDir,
      tables: DEFAULT_TABLES,
    });

    expect(result.filePath).toBeDefined();
    expect(result.counts).toEqual({
      users: 1,
      profiles: 1,
      parties: 1,
      offers: 1,
      needs: 1,
      memberships: 1,
    });

    expect(fs.existsSync(result.filePath)).toBe(true);

    const savedContent = JSON.parse(fs.readFileSync(result.filePath, 'utf-8'));
    expect(savedContent.metadata.generator).toBe('sinaptex-essential-db-dump');
    expect(savedContent.data.users).toHaveLength(1);
    expect(savedContent.data.offers).toHaveLength(1);
    expect(savedContent.data.needs).toHaveLength(1);
    expect(savedContent.data.offers[0].title).toBe('Industrial CNC');
    expect(savedContent.data.needs[0].title).toBe('Raw Steel Supply');
  });

  it('allows selective table dumping (e.g. only offers and needs)', async () => {
    prisma.opportunity.findMany.mockResolvedValue([
      { id: 'opp-1', partyId: 'pty-1', type: 'OFFER', title: 'Industrial CNC' },
      { id: 'opp-2', partyId: 'pty-1', type: 'NEED', title: 'Raw Steel Supply' },
    ]);

    const result = await dumpEssentialTables({
      outDir: testOutDir,
      tables: ['offers', 'needs'],
    });

    expect(result.counts.offers).toBe(1);
    expect(result.counts.needs).toBe(1);
    expect(prisma.user.findMany).not.toHaveBeenCalled();

    const savedContent = JSON.parse(fs.readFileSync(result.filePath, 'utf-8'));
    expect(savedContent.data.users).toBeUndefined();
    expect(savedContent.data.offers).toHaveLength(1);
    expect(savedContent.data.needs).toHaveLength(1);
  });
});
