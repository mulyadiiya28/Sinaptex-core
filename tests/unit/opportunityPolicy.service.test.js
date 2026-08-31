const opportunityPolicyService = require('../../src/modules/opportunity/opportunityPolicy.service');
const membershipService = require('../../src/modules/membership/membership.service');
const prisma = require('../../src/config/prisma');
const ErrorCodes = require('../../src/utils/errorCodes');

jest.mock('../../src/modules/membership/membership.service');
jest.mock('../../src/config/prisma', () => ({
  $queryRaw: jest.fn(),
  opportunity: {
    count: jest.fn(),
  },
}));

describe('Opportunity Policy Service - Quota Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLimit', () => {
    const mockPolicy = {
      freeMaxActiveNeeds: 1,
      freeMaxActiveOffers: 1,
      memberMaxActiveNeeds: 20,
      memberMaxActiveOffers: 20,
    };

    it('returns 1 for non-members for both NEED and OFFER', () => {
      expect(opportunityPolicyService.getLimit(mockPolicy, { isMember: false, type: 'NEED' })).toBe(1);
      expect(opportunityPolicyService.getLimit(mockPolicy, { isMember: false, type: 'OFFER' })).toBe(1);
    });

    it('returns 20 for active members for both NEED and OFFER', () => {
      expect(opportunityPolicyService.getLimit(mockPolicy, { isMember: true, type: 'NEED' })).toBe(20);
      expect(opportunityPolicyService.getLimit(mockPolicy, { isMember: true, type: 'OFFER' })).toBe(20);
    });
  });

  describe('checkOpportunityQuota', () => {
    it('allows a non-member when active count is 0', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(false);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await opportunityPolicyService.checkOpportunityQuota('profile-123', 'OFFER');

      expect(result.isMember).toBe(false);
      expect(result.maxAllowed).toBe(1);
      expect(result.currentCount).toBe(0);
      expect(result.canCreate).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('disallows a non-member when active count is already 1', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(false);
      prisma.opportunity.count.mockResolvedValue(1);

      const result = await opportunityPolicyService.checkOpportunityQuota('profile-123', 'NEED');

      expect(result.isMember).toBe(false);
      expect(result.maxAllowed).toBe(1);
      expect(result.currentCount).toBe(1);
      expect(result.canCreate).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('allows a member when active count is 19', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(true);
      prisma.opportunity.count.mockResolvedValue(19);

      const result = await opportunityPolicyService.checkOpportunityQuota('profile-123', 'OFFER');

      expect(result.isMember).toBe(true);
      expect(result.maxAllowed).toBe(20);
      expect(result.currentCount).toBe(19);
      expect(result.canCreate).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('disallows a member when active count reaches 20', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(true);
      prisma.opportunity.count.mockResolvedValue(20);

      const result = await opportunityPolicyService.checkOpportunityQuota('profile-123', 'NEED');

      expect(result.isMember).toBe(true);
      expect(result.maxAllowed).toBe(20);
      expect(result.currentCount).toBe(20);
      expect(result.canCreate).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('enforceOpportunityQuota', () => {
    it('succeeds without throwing when quota is not exceeded', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(false);
      prisma.opportunity.count.mockResolvedValue(0);

      const res = await opportunityPolicyService.enforceOpportunityQuota('profile-123', 'OFFER');
      expect(res.canCreate).toBe(true);
    });

    it('throws ApiError.forbidden with OFFER_QUOTA_EXCEEDED for non-members exceeding 1 offer', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(false);
      prisma.opportunity.count.mockResolvedValue(1);

      await expect(
        opportunityPolicyService.enforceOpportunityQuota('profile-123', 'OFFER')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.OFFER_QUOTA_EXCEEDED,
      });
    });

    it('throws ApiError.forbidden with NEED_QUOTA_EXCEEDED for members exceeding 20 needs', async () => {
      membershipService.hasActiveMembership.mockResolvedValue(true);
      prisma.opportunity.count.mockResolvedValue(20);

      await expect(
        opportunityPolicyService.enforceOpportunityQuota('profile-123', 'NEED')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.NEED_QUOTA_EXCEEDED,
      });
    });
  });
});
