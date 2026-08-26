const { classifyPattern } = require('../../src/modules/intent/intent.service');

describe('classifyPattern — contoh persis dari spesifikasi user', () => {
  it('"Saya mau cari supplier kopi." -> DIRECT_SEARCH (role: supplier)', () => {
    const result = classifyPattern('Saya mau cari supplier kopi.');
    expect(result.category).toBe('DIRECT_SEARCH');
    expect(result.subtype).toBe('SEARCH_PARTY_ROLE');
  });

  it('"Penjualan saya turun." -> NEEDS_DIAGNOSIS (symptom: turun)', () => {
    const result = classifyPattern('Penjualan saya turun.');
    expect(result.category).toBe('NEEDS_DIAGNOSIS');
    expect(result.subtype).toBe('BUSINESS_DIAGNOSIS');
  });

  it('"Saya ingin mencari investor." -> DIRECT_SEARCH (role: investor)', () => {
    const result = classifyPattern('Saya ingin mencari investor.');
    expect(result.category).toBe('DIRECT_SEARCH');
    expect(result.subtype).toBe('SEARCH_PARTY_ROLE');
  });

  it('"Mengapa laba saya turun?" -> NEEDS_DIAGNOSIS (interrogative wins over symptom keyword)', () => {
    const result = classifyPattern('Mengapa laba saya turun?');
    expect(result.category).toBe('NEEDS_DIAGNOSIS');
    expect(result.subtype).toBe('ADVISORY_OR_ANALYSIS');
  });

  it('"Saya ingin membeli mesin." -> PENDING_KB_LOOKUP (acquisition verb, no role, needs async KB check)', () => {
    const result = classifyPattern('Saya ingin membeli mesin.');
    expect(result.category).toBe('PENDING_KB_LOOKUP');
  });

  it('"Bagaimana meningkatkan produktivitas?" -> NEEDS_DIAGNOSIS (interrogative)', () => {
    const result = classifyPattern('Bagaimana meningkatkan produktivitas?');
    expect(result.category).toBe('NEEDS_DIAGNOSIS');
    expect(result.subtype).toBe('ADVISORY_OR_ANALYSIS');
  });
});

describe('classifyPattern — edge cases', () => {
  it('empty/whitespace text -> AMBIGUOUS, never guesses', () => {
    expect(classifyPattern('').category).toBe('AMBIGUOUS');
    expect(classifyPattern('   ').category).toBe('AMBIGUOUS');
  });

  it('random unrelated text with no pattern -> AMBIGUOUS', () => {
    expect(classifyPattern('halo apa kabar').category).toBe('AMBIGUOUS');
  });

  it('interrogative pattern takes priority over a symptom keyword in the same sentence', () => {
    // "kenapa" (Rule 1) should win even though "menurun" (Rule 2) is also present
    const result = classifyPattern('Kenapa penjualan saya menurun terus?');
    expect(result.subtype).toBe('ADVISORY_OR_ANALYSIS');
    expect(result.matchedPattern).toBe('kenapa');
  });

  it('acquisition verb + role keyword together -> DIRECT_SEARCH even without explicit "cari"', () => {
    const result = classifyPattern('saya butuh distributor untuk produk saya');
    expect(result.category).toBe('DIRECT_SEARCH');
  });

  it('is case-insensitive', () => {
    const result = classifyPattern('CARI SUPPLIER KOPI');
    expect(result.category).toBe('DIRECT_SEARCH');
  });
});
