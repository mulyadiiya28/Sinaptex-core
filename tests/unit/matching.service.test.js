const { computeMatchScore, passesHardFilter, WEIGHTS } = require('../../src/modules/matching/matching.service');

function makeOpportunity(overrides = {}) {
  return {
    id: 'opp-1',
    type: 'NEED',
    status: 'ACTIVE',
    categoryId: 'cat-1',
    visibility: 'PUBLIC',
    title: 'Butuh supplier kopi arabika',
    description: 'Mencari supplier biji kopi arabika kualitas ekspor untuk kafe di Bandung',
    location: 'Bandung',
    budgetMin: 10000000,
    budgetMax: 50000000,
    tags: ['kopi', 'f&b'],
    priority: 'MEDIUM',
    capabilities: [{ capabilityId: 'cap-coffee' }],
    ...overrides,
  };
}

describe('passesHardFilter', () => {
  it('rejects same-type pairs (NEED vs NEED)', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'NEED' });
    expect(passesHardFilter(source, candidate)).toBe(false);
  });

  it('accepts opposite-type pairs (NEED vs OFFER) with matching defaults', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'OFFER' });
    expect(passesHardFilter(source, candidate)).toBe(true);
  });

  it('rejects candidate that is not ACTIVE', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'OFFER', status: 'DRAFT' });
    expect(passesHardFilter(source, candidate)).toBe(false);
  });

  it('rejects mismatched category when both sides declare one', () => {
    const source = makeOpportunity({ type: 'NEED', categoryId: 'cat-1' });
    const candidate = makeOpportunity({ type: 'OFFER', categoryId: 'cat-2' });
    expect(passesHardFilter(source, candidate)).toBe(false);
  });

  it('allows candidate with no category set (category filter only applies when both declare one)', () => {
    const source = makeOpportunity({ type: 'NEED', categoryId: 'cat-1' });
    const candidate = makeOpportunity({ type: 'OFFER', categoryId: null });
    expect(passesHardFilter(source, candidate)).toBe(true);
  });

  it('rejects PRIVATE visibility candidates unconditionally', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'OFFER', visibility: 'PRIVATE' });
    expect(passesHardFilter(source, candidate)).toBe(false);
  });

  it('rejects VERIFIED_ONLY candidate when either side is unverified', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'OFFER', visibility: 'VERIFIED_ONLY' });
    expect(passesHardFilter(source, candidate, { sourceVerified: true, candidateVerified: false })).toBe(
      false
    );
  });

  it('accepts VERIFIED_ONLY candidate when both sides are verified', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({ type: 'OFFER', visibility: 'VERIFIED_ONLY' });
    expect(passesHardFilter(source, candidate, { sourceVerified: true, candidateVerified: true })).toBe(
      true
    );
  });
});

describe('computeMatchScore', () => {
  it('returns a perfect-ish high score for near-identical opposite opportunities', () => {
    const source = makeOpportunity({ type: 'NEED' });
    const candidate = makeOpportunity({
      type: 'OFFER',
      title: 'Menjual biji kopi arabika ekspor',
      description: 'Supplier biji kopi arabika kualitas ekspor siap kirim ke Bandung',
    });
    const { score, breakdown } = computeMatchScore(source, candidate);

    expect(score).toBeGreaterThan(70);
    expect(breakdown.capabilityMatch).toBe(1); // identical capability sets
    expect(breakdown.location).toBe(1); // exact same location string
    expect(breakdown.tags).toBe(1); // identical tag sets
  });

  it('returns a low score for completely unrelated opportunities', () => {
    const source = makeOpportunity({
      type: 'NEED',
      title: 'Butuh jasa konsultan pajak',
      description: 'Mencari konsultan pajak untuk UMKM di Jakarta',
      location: 'Jakarta',
      tags: ['pajak', 'konsultasi'],
      capabilities: [{ capabilityId: 'cap-tax' }],
      budgetMin: 5000000,
      budgetMax: 8000000,
    });
    const candidate = makeOpportunity({
      type: 'OFFER',
      title: 'Menjual mesin CNC bekas',
      description: 'Mesin CNC kondisi baik untuk manufaktur logam',
      location: 'Surabaya',
      tags: ['mesin', 'manufaktur'],
      capabilities: [{ capabilityId: 'cap-cnc' }],
      budgetMin: 200000000,
      budgetMax: 500000000,
    });
    const { score } = computeMatchScore(source, candidate);

    expect(score).toBeLessThan(30);
  });

  it('weights sum to 1 (sanity check on WEIGHTS config)', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('never returns a score outside [0, 100]', () => {
    const source = makeOpportunity();
    const candidate = makeOpportunity({ type: 'OFFER', budgetMin: undefined, budgetMax: undefined, tags: [] });
    const { score } = computeMatchScore(source, candidate);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('gives budget score of 0 when ranges do not overlap at all', () => {
    const source = makeOpportunity({ budgetMin: 1000000, budgetMax: 2000000 });
    const candidate = makeOpportunity({ type: 'OFFER', budgetMin: 100000000, budgetMax: 200000000 });
    const { breakdown } = computeMatchScore(source, candidate);
    expect(breakdown.budget).toBe(0);
  });

  it('treats missing capability declaration as neutral-low rather than zero', () => {
    const source = makeOpportunity({ capabilities: [] });
    const candidate = makeOpportunity({ type: 'OFFER', capabilities: [] });
    const { breakdown } = computeMatchScore(source, candidate);
    expect(breakdown.capabilityMatch).toBe(0.3);
  });
});
