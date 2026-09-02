const { createReviewSchema } = require('../../src/validations/review.validation');

describe('Review Validation (createReviewSchema)', () => {
  it('accepts valid review payload with rating 1-5 and uuid', () => {
    const validParams = { dealId: '11111111-1111-1111-1111-111111111111' };
    const validBody = {
      revieweeId: '22222222-2222-2222-2222-222222222222',
      rating: 5,
      comment: 'Kerjasama sangat memuaskan, pengiriman tepat waktu!',
    };

    const paramRes = createReviewSchema.params.safeParse(validParams);
    const bodyRes = createReviewSchema.body.safeParse(validBody);

    expect(paramRes.success).toBe(true);
    expect(bodyRes.success).toBe(true);
  });

  it('rejects invalid dealId or revieweeId if not UUID', () => {
    const invalidParams = { dealId: 'not-a-uuid' };
    const invalidBody = {
      revieweeId: 'invalid-id',
      rating: 4,
    };

    expect(createReviewSchema.params.safeParse(invalidParams).success).toBe(false);
    expect(createReviewSchema.body.safeParse(invalidBody).success).toBe(false);
  });

  it('rejects ratings less than 1 or greater than 5 or non-integers', () => {
    const base = { revieweeId: '22222222-2222-2222-2222-222222222222' };

    expect(createReviewSchema.body.safeParse({ ...base, rating: 0 }).success).toBe(false);
    expect(createReviewSchema.body.safeParse({ ...base, rating: 6 }).success).toBe(false);
    expect(createReviewSchema.body.safeParse({ ...base, rating: 4.5 }).success).toBe(false);
  });

  it('allows review without optional comment, but rejects oversized comments', () => {
    const base = {
      revieweeId: '22222222-2222-2222-2222-222222222222',
      rating: 4,
    };

    expect(createReviewSchema.body.safeParse(base).success).toBe(true);
    expect(
      createReviewSchema.body.safeParse({
        ...base,
        comment: 'a'.repeat(1001),
      }).success
    ).toBe(false);
  });
});
