const { createOpportunitySchema } = require('../../src/validations/opportunity.validation');

function validBody(overrides = {}) {
  return {
    partyId: '11111111-1111-1111-1111-111111111111',
    type: 'NEED',
    title: 'Butuh supplier kopi',
    description: 'Mencari supplier biji kopi arabika kualitas ekspor untuk kafe',
    tags: ['kopi'],
    ...overrides,
  };
}

describe('createOpportunitySchema', () => {
  it('accepts a valid minimal payload', () => {
    const result = createOpportunitySchema.body.safeParse(validBody());
    expect(result.success).toBe(true);
  });

  it('rejects when budgetMin > budgetMax', () => {
    const result = createOpportunitySchema.body.safeParse(
      validBody({ budgetMin: 5000000, budgetMax: 1000000 })
    );
    expect(result.success).toBe(false);
  });

  it('accepts when budgetMin <= budgetMax', () => {
    const result = createOpportunitySchema.body.safeParse(
      validBody({ budgetMin: 1000000, budgetMax: 5000000 })
    );
    expect(result.success).toBe(true);
  });

  it('rejects invalid type enum value', () => {
    const result = createOpportunitySchema.body.safeParse(validBody({ type: 'WISH' }));
    expect(result.success).toBe(false);
  });

  it('rejects title shorter than 3 characters', () => {
    const result = createOpportunitySchema.body.safeParse(validBody({ title: 'ab' }));
    expect(result.success).toBe(false);
  });

  it('defaults priority to MEDIUM and visibility to PUBLIC when omitted', () => {
    const result = createOpportunitySchema.body.parse(validBody());
    expect(result.priority).toBe('MEDIUM');
    expect(result.visibility).toBe('PUBLIC');
  });
});
