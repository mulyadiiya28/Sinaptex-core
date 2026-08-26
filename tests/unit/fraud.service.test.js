const {
  checkSameOwner,
  checkSharedLegalIdentity,
  checkCompletionVelocity,
} = require('../../src/modules/fraud/fraud.service');

describe('checkSameOwner', () => {
  it('flags CRITICAL when both parties share an ownerId', () => {
    const partyA = { id: 'p1', name: 'Toko A', ownerId: 'owner-1' };
    const partyB = { id: 'p2', name: 'Toko B', ownerId: 'owner-1' };
    const finding = checkSameOwner(partyA, partyB);
    expect(finding).not.toBeNull();
    expect(finding.severity).toBe('CRITICAL');
    expect(finding.reasonCode).toBe('SAME_OWNER');
  });

  it('returns null when owners differ', () => {
    const partyA = { id: 'p1', name: 'Toko A', ownerId: 'owner-1' };
    const partyB = { id: 'p2', name: 'Toko B', ownerId: 'owner-2' };
    expect(checkSameOwner(partyA, partyB)).toBeNull();
  });
});

describe('checkSharedLegalIdentity', () => {
  it('flags CRITICAL when NPWP matches', () => {
    const partyA = { name: 'Toko A', npwp: '01.234.567.8-901.000', nib: null };
    const partyB = { name: 'Toko B', npwp: '01.234.567.8-901.000', nib: null };
    const finding = checkSharedLegalIdentity(partyA, partyB);
    expect(finding).not.toBeNull();
    expect(finding.severity).toBe('CRITICAL');
  });

  it('flags CRITICAL when NIB matches', () => {
    const partyA = { name: 'Toko A', npwp: null, nib: '1234567890123' };
    const partyB = { name: 'Toko B', npwp: null, nib: '1234567890123' };
    expect(checkSharedLegalIdentity(partyA, partyB)).not.toBeNull();
  });

  it('returns null when both are null/undefined (nothing to compare)', () => {
    const partyA = { name: 'Toko A', npwp: null, nib: null };
    const partyB = { name: 'Toko B', npwp: null, nib: null };
    expect(checkSharedLegalIdentity(partyA, partyB)).toBeNull();
  });

  it('returns null when identifiers differ', () => {
    const partyA = { name: 'Toko A', npwp: '111', nib: null };
    const partyB = { name: 'Toko B', npwp: '222', nib: null };
    expect(checkSharedLegalIdentity(partyA, partyB)).toBeNull();
  });
});

describe('checkCompletionVelocity', () => {
  it('flags when a deal completes less than 1 hour after starting', () => {
    const deal = { startAt: new Date(Date.now() - 10 * 60 * 1000) }; // 10 minutes ago
    const finding = checkCompletionVelocity(deal);
    expect(finding).not.toBeNull();
    expect(finding.severity).toBe('LOW');
  });

  it('does not flag a deal that took several days', () => {
    const deal = { startAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) };
    expect(checkCompletionVelocity(deal)).toBeNull();
  });

  it('returns null when startAt is missing', () => {
    expect(checkCompletionVelocity({ startAt: null })).toBeNull();
  });
});
