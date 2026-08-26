const { tokenize, jaccard, textSimilarity } = require('../../src/shared/textSimilarity');

describe('tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize('CRM Software!')).toEqual(new Set(['crm', 'software']));
  });

  it('drops short words (<=2 chars)', () => {
    expect(tokenize('a di ke rumah')).toEqual(new Set(['rumah']));
  });

  it('returns empty set for empty/undefined input', () => {
    expect(tokenize('')).toEqual(new Set());
    expect(tokenize(undefined)).toEqual(new Set());
  });
});

describe('jaccard', () => {
  it('returns 1 for identical sets', () => {
    const a = new Set(['kopi', 'arabika']);
    expect(jaccard(a, new Set(a))).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccard(new Set(['kopi']), new Set(['bor']))).toBe(0);
  });

  it('returns 0 for two empty sets', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it('computes partial overlap correctly', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd']);
    // intersection = {b,c} = 2, union = {a,b,c,d} = 4
    expect(jaccard(a, b)).toBe(0.5);
  });
});

describe('textSimilarity', () => {
  it('scores near-identical sentences highly', () => {
    const score = textSimilarity(
      'Butuh supplier kopi arabika kualitas ekspor',
      'Menjual kopi arabika kualitas ekspor siap kirim'
    );
    expect(score).toBeGreaterThan(0.3);
  });

  it('scores unrelated sentences near zero', () => {
    const score = textSimilarity('Butuh bor listrik untuk melubangi dinding', 'Mencari jasa konsultan pajak UMKM');
    expect(score).toBeLessThan(0.15);
  });
});
