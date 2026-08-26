const { parseFactorValue, evaluateCondition } = require('../../src/modules/business-diagnosis/diagnosis.service');

describe('parseFactorValue', () => {
  it('parses BOOLEAN "true"/"false" strings correctly', () => {
    expect(parseFactorValue('true', 'BOOLEAN')).toBe(true);
    expect(parseFactorValue('false', 'BOOLEAN')).toBe(false);
  });

  it('parses NUMERIC and PERCENTAGE as numbers', () => {
    expect(parseFactorValue('12.5', 'NUMERIC')).toBe(12.5);
    expect(parseFactorValue('8', 'PERCENTAGE')).toBe(8);
  });

  it('leaves CATEGORICAL as raw string', () => {
    expect(parseFactorValue('lokasi_premium', 'CATEGORICAL')).toBe('lokasi_premium');
  });
});

describe('evaluateCondition', () => {
  it('LT / LTE / GT / GTE work as expected on numbers', () => {
    expect(evaluateCondition('LT', 10, 15)).toBe(true);
    expect(evaluateCondition('LT', 20, 15)).toBe(false);
    expect(evaluateCondition('LTE', 15, 15)).toBe(true);
    expect(evaluateCondition('GT', 20, 15)).toBe(true);
    expect(evaluateCondition('GTE', 15, 15)).toBe(true);
  });

  it('EQ / NEQ work on both numbers and strings', () => {
    expect(evaluateCondition('EQ', 'a', 'a')).toBe(true);
    expect(evaluateCondition('NEQ', 'a', 'b')).toBe(true);
    expect(evaluateCondition('EQ', 5, 5)).toBe(true);
  });

  it('IS_TRUE / IS_FALSE only match strict booleans', () => {
    expect(evaluateCondition('IS_TRUE', true)).toBe(true);
    expect(evaluateCondition('IS_TRUE', false)).toBe(false);
    expect(evaluateCondition('IS_FALSE', false)).toBe(true);
    expect(evaluateCondition('IS_FALSE', true)).toBe(false);
  });

  it('IN checks membership in an array', () => {
    expect(evaluateCondition('IN', 'b', ['a', 'b', 'c'])).toBe(true);
    expect(evaluateCondition('IN', 'z', ['a', 'b', 'c'])).toBe(false);
  });

  it('unknown operator safely returns false', () => {
    expect(evaluateCondition('WHATEVER', 5, 5)).toBe(false);
  });

  it('mirrors the seeded rule: conversionRate < 15 AND training IS_FALSE both must hold', () => {
    // Skill-gap root cause rule from prisma/seed.js
    const conversionRate = 8; // %
    const trainingDone = false;
    expect(evaluateCondition('LT', conversionRate, 15)).toBe(true);
    expect(evaluateCondition('IS_FALSE', trainingDone)).toBe(true);

    // If staff DID get training, this root cause should NOT fire even with low conversion
    expect(evaluateCondition('IS_FALSE', true)).toBe(false);
  });

  it('mirrors the seeded rule: sentiment < 60 triggers advisory-only root cause', () => {
    expect(evaluateCondition('LT', 45, 60)).toBe(true);
    expect(evaluateCondition('LT', 75, 60)).toBe(false);
  });
});
