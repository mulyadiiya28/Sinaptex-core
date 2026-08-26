const { toSkipTake, buildMeta, paginationQuerySchema } = require('../../src/shared/pagination');

describe('toSkipTake', () => {
  it('computes skip/take for page 1', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('computes skip/take for page 3', () => {
    expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe('buildMeta', () => {
  it('computes totalPages, rounding up', () => {
    expect(buildMeta({ page: 1, limit: 20, total: 45 })).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('returns at least 1 totalPages even when total is 0', () => {
    expect(buildMeta({ page: 1, limit: 20, total: 0 }).totalPages).toBe(1);
  });
});

describe('paginationQuerySchema', () => {
  it('defaults page=1 and limit=20 when omitted', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('coerces string query params to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '2', limit: '5' });
    expect(result).toEqual({ page: 2, limit: 5 });
  });

  it('rejects limit above 100', () => {
    expect(() => paginationQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('rejects non-positive page', () => {
    expect(() => paginationQuerySchema.parse({ page: '0' })).toThrow();
  });
});
