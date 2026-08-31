jest.mock('../../src/modules/membership/membership.service', () => ({
  hasActiveMembership: jest.fn(),
}));

const membershipService = require('../../src/modules/membership/membership.service');
const chatPolicy = require('../../src/modules/chat/chat.policy');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('canStartConversation', () => {
  it('rejects starting a conversation with yourself, regardless of originType', async () => {
    const result = await chatPolicy.canStartConversation({
      initiatorProfileId: 'p1',
      recipientProfileId: 'p1',
      originType: 'OFFER',
    });
    expect(result.allowed).toBe(false);
    expect(membershipService.hasActiveMembership).not.toHaveBeenCalled();
  });

  it('originType NEED and OFFER are both free without membership gating (FR-16)', async () => {
    const resultNeed = await chatPolicy.canStartConversation({
      initiatorProfileId: 'provider-1',
      recipientProfileId: 'need-owner-1',
      originType: 'NEED',
    });
    expect(resultNeed.allowed).toBe(true);

    const resultOffer = await chatPolicy.canStartConversation({
      initiatorProfileId: 'buyer-1',
      recipientProfileId: 'provider-1',
      originType: 'OFFER',
    });
    expect(resultOffer.allowed).toBe(true);
    expect(membershipService.hasActiveMembership).not.toHaveBeenCalled();
  });

  it('originType PROFILE (direct chat) requires recipient active membership', async () => {
    membershipService.hasActiveMembership.mockResolvedValue(false);
    const result = await chatPolicy.canStartConversation({
      initiatorProfileId: 'p1',
      recipientProfileId: 'p2',
      originType: 'PROFILE',
    });
    expect(result.allowed).toBe(false);
    expect(membershipService.hasActiveMembership).toHaveBeenCalledWith('p2');

    membershipService.hasActiveMembership.mockResolvedValue(true);
    const resultAllowed = await chatPolicy.canStartConversation({
      initiatorProfileId: 'p1',
      recipientProfileId: 'p2',
      originType: 'PROFILE',
    });
    expect(resultAllowed.allowed).toBe(true);
  });
});

describe('canViewConversation', () => {
  it('allows a participant to view', () => {
    const result = chatPolicy.canViewConversation(['p1', 'p2'], 'p1');
    expect(result.allowed).toBe(true);
  });

  it('rejects a non-participant', () => {
    const result = chatPolicy.canViewConversation(['p1', 'p2'], 'p3');
    expect(result.allowed).toBe(false);
  });
});

describe('canDeleteConversation', () => {
  it('is not supported yet in MVP (explicit stub)', () => {
    const result = chatPolicy.canDeleteConversation({}, 'p1');
    expect(result.allowed).toBe(false);
  });
});
