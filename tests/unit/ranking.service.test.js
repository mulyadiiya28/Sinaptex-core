const { computeFinalScore, verificationStatusToScore } = require('../../src/modules/ranking/ranking.service');

function makeParty(overrides = {}) {
  return {
    reputationScore: 80,
    responseScore: 70,
    completionScore: 90,
    activityScore: 50,
    verificationStatus: 'VERIFIED',
    ...overrides,
  };
}

describe('verificationStatusToScore', () => {
  it.each([
    ['VERIFIED', 100],
    ['PENDING', 40],
    ['REJECTED', 10],
    ['UNVERIFIED', 0],
  ])('maps %s to %i', (status, expected) => {
    expect(verificationStatusToScore(status)).toBe(expected);
  });

  it('defaults unknown status to 0', () => {
    expect(verificationStatusToScore('SOMETHING_ELSE')).toBe(0);
  });
});

describe('computeFinalScore', () => {
  it('gives a higher finalScore to a party with better reputation, all else equal', () => {
    const base = { matchScore: 60 };

    const weakParty = makeParty({ reputationScore: 20, completionScore: 20, responseScore: 20 });
    const strongParty = makeParty({ reputationScore: 95, completionScore: 95, responseScore: 95 });

    const weak = computeFinalScore({ ...base, party: weakParty });
    const strong = computeFinalScore({ ...base, party: strongParty });

    expect(strong.finalScore).toBeGreaterThan(weak.finalScore);
  });

  it('boosted opportunities score higher than unboosted, all else equal', () => {
    const base = { matchScore: 60, party: makeParty() };

    const unboosted = computeFinalScore({ ...base, boostPriorityWeight: 0 });
    const boosted = computeFinalScore({ ...base, boostPriorityWeight: 100 });

    expect(boosted.finalScore).toBeGreaterThan(unboosted.finalScore);
  });

  it('applies cancel penalty, capped at 30', () => {
    const base = { matchScore: 60, party: makeParty() };

    const noCancel = computeFinalScore({ ...base, cancelCount: 0 });
    const someCancel = computeFinalScore({ ...base, cancelCount: 3 });
    const manyCancel = computeFinalScore({ ...base, cancelCount: 100 });

    expect(someCancel.finalScore).toBeLessThan(noCancel.finalScore);
    expect(manyCancel.breakdown.cancelPenalty).toBe(-30); // capped
  });

  it('applies expired penalty, capped at 20', () => {
    const base = { matchScore: 60, party: makeParty() };
    const manyExpired = computeFinalScore({ ...base, expiredCount: 999 });
    expect(manyExpired.breakdown.expiredPenalty).toBe(-20); // capped
  });

  it('never returns a negative finalScore even with heavy penalties', () => {
    const result = computeFinalScore({
      matchScore: 0,
      party: makeParty({
        reputationScore: 0,
        responseScore: 0,
        completionScore: 0,
        activityScore: 0,
        verificationStatus: 'UNVERIFIED',
      }),
      boostPriorityWeight: 0,
      cancelCount: 50,
      expiredCount: 50,
    });
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps out-of-range party scores into [0, 100] before weighting', () => {
    const result = computeFinalScore({
      matchScore: 60,
      party: makeParty({ reputationScore: 500, activityScore: -50 }),
    });
    // If clamping worked, breakdown.reputationScore should equal 100 * W.reputation (not 500 * W.reputation)
    const env = require('../../src/config/env');
    expect(result.breakdown.reputationScore).toBeCloseTo(100 * env.ranking.reputation, 2);
    expect(result.breakdown.activityScore).toBeCloseTo(0, 2);
  });

  it('breakdown values sum to finalScore (before the floor-at-0 clamp)', () => {
    const result = computeFinalScore({ matchScore: 60, party: makeParty() });
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(result.finalScore).toBeCloseTo(Math.max(0, sum), 2);
  });
});
