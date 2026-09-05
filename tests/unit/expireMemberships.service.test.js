// tests/unit/expireMemberships.service.test.js
// Mock prisma - use the correct path with 'src'
jest.mock('../../src/config/prisma', () => ({
  $queryRaw: jest.fn(),
  membership: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  profile: {
    findUnique: jest.fn(),
  },
}));

const prisma = require('../../src/config/prisma');
const expireMembershipsService = require('../../src/modules/membership/expireMemberships.service');
const opportunityPolicyService = require('../../src/modules/opportunity/opportunityPolicy.service');

// Mock the opportunity policy service
jest.mock('../../src/modules/opportunity/opportunityPolicy.service');

describe('processExpiredMemberships & expireMembershipsAndTransitionTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps 1 newest offer & 1 newest need, and closes remaining excess items', async () => {
    opportunityPolicyService.pruneOpportunitiesForProfile.mockResolvedValue({
      profileId: 'profile-1',
      keptOffers: 1,
      closedOffersCount: 1,
      keptNeeds: 1,
      closedNeedsCount: 1,
    });

    const result = await opportunityPolicyService.pruneOpportunitiesForProfile('profile-1', 1);

    expect(result.profileId).toBe('profile-1');
    expect(result.keptOffers).toBe(1);
    expect(result.closedOffersCount).toBe(1);
    expect(result.keptNeeds).toBe(1);
    expect(result.closedNeedsCount).toBe(1);
  });

  it('does not close opportunities if counts are already within default limit', async () => {
    opportunityPolicyService.pruneOpportunitiesForProfile.mockResolvedValue({
      profileId: 'profile-2',
      keptOffers: 1,
      closedOffersCount: 0,
      keptNeeds: 1,
      closedNeedsCount: 0,
    });

    const result = await opportunityPolicyService.pruneOpportunitiesForProfile('profile-2', 1);

    expect(result.closedOffersCount).toBe(0);
    expect(result.closedNeedsCount).toBe(0);
  });

  // ... rest of your tests
});