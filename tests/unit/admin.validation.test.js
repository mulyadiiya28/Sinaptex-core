const { suspendUserSchema, setReviewVisibilitySchema } = require('../../src/validations/admin.validation');

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('suspendUserSchema', () => {
  it('accepts ACTIVE without a reason', () => {
    const result = suspendUserSchema.body.safeParse({ accountStatus: 'ACTIVE' });
    expect(result.success).toBe(true);
  });

  it('rejects SUSPENDED without a reason', () => {
    const result = suspendUserSchema.body.safeParse({ accountStatus: 'SUSPENDED' });
    expect(result.success).toBe(false);
  });

  it('accepts SUSPENDED with a reason', () => {
    const result = suspendUserSchema.body.safeParse({ accountStatus: 'SUSPENDED', reason: 'Spam berulang' });
    expect(result.success).toBe(true);
  });

  it('rejects BANNED without a reason', () => {
    const result = suspendUserSchema.body.safeParse({ accountStatus: 'BANNED' });
    expect(result.success).toBe(false);
  });

  it('validates the id param as a UUID', () => {
    expect(suspendUserSchema.params.safeParse({ id: VALID_UUID }).success).toBe(true);
    expect(suspendUserSchema.params.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('setReviewVisibilitySchema', () => {
  it('accepts hidden=false without hiddenReason', () => {
    const result = setReviewVisibilitySchema.body.safeParse({ hidden: false });
    expect(result.success).toBe(true);
  });

  it('rejects hidden=true without hiddenReason', () => {
    const result = setReviewVisibilitySchema.body.safeParse({ hidden: true });
    expect(result.success).toBe(false);
  });

  it('accepts hidden=true with hiddenReason', () => {
    const result = setReviewVisibilitySchema.body.safeParse({ hidden: true, hiddenReason: 'Konten fitnah' });
    expect(result.success).toBe(true);
  });
});
