const {
  verifyEscrowPartyOwnership,
  verifyEscrowParticipation,
  requireEscrowPartyOwner,
  requireEscrowParticipant,
} = require('../../src/middlewares/escrowAuth.middleware');

describe('Escrow Authorization Middleware & Validators', () => {
  describe('verifyEscrowPartyOwnership', () => {
    it('returns error when profile is missing', () => {
      const result = verifyEscrowPartyOwnership(null, { id: 'party-1', ownerId: 'p1' });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('returns error when party is not found', () => {
      const result = verifyEscrowPartyOwnership({ id: 'p1' }, null);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('returns error when caller is not the party owner', () => {
      const result = verifyEscrowPartyOwnership(
        { id: 'caller-1' },
        { id: 'party-1', ownerId: 'different-owner' }
      );
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('ESCROW_PARTY_MISMATCH');
    });

    it('returns error when verification is required but party is unverified', () => {
      const result = verifyEscrowPartyOwnership(
        { id: 'p1' },
        { id: 'party-1', ownerId: 'p1', verification: { status: 'UNVERIFIED' } },
        { requireVerification: true }
      );
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('ESCROW_NOT_VERIFIED');
    });

    it('returns allowed when owner matches and requirements are met', () => {
      const result = verifyEscrowPartyOwnership(
        { id: 'p1' },
        { id: 'party-1', ownerId: 'p1', verification: { status: 'VERIFIED' } },
        { requireVerification: true }
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('verifyEscrowParticipation', () => {
    const mockEscrow = {
      id: 'escrow-1',
      buyerParty: { ownerId: 'buyer-owner-1' },
      sellerParty: { ownerId: 'seller-owner-2' },
    };

    it('returns error when caller is not participant on ANY check', () => {
      const result = verifyEscrowParticipation({ id: 'stranger-3' }, mockEscrow, 'ANY');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('ESCROW_UNAUTHORIZED');
    });

    it('allows buyer when role BUYER is requested', () => {
      const result = verifyEscrowParticipation({ id: 'buyer-owner-1' }, mockEscrow, 'BUYER');
      expect(result.allowed).toBe(true);
      expect(result.isBuyer).toBe(true);
      expect(result.isSeller).toBe(false);
    });

    it('rejects seller when role BUYER is requested', () => {
      const result = verifyEscrowParticipation({ id: 'seller-owner-2' }, mockEscrow, 'BUYER');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('ESCROW_UNAUTHORIZED');
    });

    it('allows seller when role SELLER is requested', () => {
      const result = verifyEscrowParticipation({ id: 'seller-owner-2' }, mockEscrow, 'SELLER');
      expect(result.allowed).toBe(true);
      expect(result.isSeller).toBe(true);
      expect(result.isBuyer).toBe(false);
    });
  });

  describe('middleware factories', () => {
    it('exports requireEscrowPartyOwner and requireEscrowParticipant middleware functions', () => {
      expect(typeof requireEscrowPartyOwner).toBe('function');
      expect(typeof requireEscrowParticipant).toBe('function');
    });
  });
});
