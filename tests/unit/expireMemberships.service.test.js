const opportunityPolicyService = require('../../src/modules/opportunity/opportunityPolicy.service');
const {
  expireMembershipsAndTransitionTier,
} = require('../../src/modules/membership/expireMemberships.service');
const prisma = require('../../src/config/prisma');

jest.mock('../../src/config/prisma', () => ({
  $queryRaw: jest.fn(),
  membership: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  opportunity: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
}));

describe('processExpiredMemberships & expireMembershipsAndTransitionTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pruneOpportunitiesForProfile', () => {
    it('keeps 1 newest offer & 1 newest need, and closes remaining excess items', async () => {
      prisma.opportunity.findMany
        .mockResolvedValueOnce([
          { id: 'offer-3' }, // newest (keep)
          { id: 'offer-2' }, // excess (close)
          { id: 'offer-1' }, // excess (close)
        ])
        .mockResolvedValueOnce([
          { id: 'need-2' }, // newest (keep)
          { id: 'need-1' }, // excess (close)
        ]);

      prisma.opportunity.updateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await opportunityPolicyService.pruneOpportunitiesForProfile('profile-1', 1);

      expect(result.profileId).toBe('profile-1');
      expect(result.keptOffers).toBe(1);
      expect(result.closedOffersCount).toBe(2);
      expect(result.keptNeeds).toBe(1);
      expect(result.closedNeedsCount).toBe(1);

      expect(prisma.opportunity.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: { in: ['offer-2', 'offer-1'] } },
        data: { status: 'CLOSED' },
      });
      expect(prisma.opportunity.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: { in: ['need-1'] } },
        data: { status: 'CLOSED' },
      });
    });

    it('does not close opportunities if counts are already within default limit', async () => {
      prisma.opportunity.findMany
        .mockResolvedValueOnce([{ id: 'offer-1' }])
        .mockResolvedValueOnce([{ id: 'need-1' }]);

      const result = await opportunityPolicyService.pruneOpportunitiesForProfile('profile-2', 1);

      expect(result.closedOffersCount).toBe(0);
      expect(result.closedNeedsCount).toBe(0);
      expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('expireMembershipsAndTransitionTier', () => {
    it('returns 0 when no memberships have expired', async () => {
      prisma.membership.findMany.mockResolvedValue([]);

      const res = await expireMembershipsAndTransitionTier();

      expect(res.expiredMembershipsCount).toBe(0);
      expect(prisma.membership.updateMany).not.toHaveBeenCalled();
    });

    it('identifies expired memberships, updates status, and transitions to non-member tier with notifications', async () => {
      prisma.membership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          profileId: 'profile-1',
          profile: {
            id: 'profile-1',
            fullName: 'Budi Santoso',
            user: { email: 'budi@example.com' },
          },
        },
      ]);
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      prisma.$queryRaw.mockResolvedValue([
        {
          freeMaxActiveNeeds: 1,
          freeMaxActiveOffers: 1,
          memberMaxActiveNeeds: 20,
          memberMaxActiveOffers: 20,
          expiredMembershipKeepCount: 1,
        },
      ]);

      prisma.opportunity.findMany
        .mockResolvedValueOnce([{ id: 'off-2' }, { id: 'off-1' }])
        .mockResolvedValueOnce([{ id: 'need-2' }, { id: 'need-1' }]);

      prisma.opportunity.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const res = await expireMembershipsAndTransitionTier();

      expect(res.expiredMembershipsCount).toBe(1);
      expect(res.totalClosedOffers).toBe(1);
      expect(res.totalClosedNeeds).toBe(1);
      expect(prisma.membership.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['mem-1'] } },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'profile-1',
            type: 'MEMBERSHIP_EXPIRED',
          }),
        })
      );
    });
  });
});
