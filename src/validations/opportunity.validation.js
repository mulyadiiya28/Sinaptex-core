const { z } = require('zod');
const { paginationQuerySchema } = require('../shared/pagination');

const createOpportunitySchema = {
  body: z
    .object({
      partyId: z.string().uuid(),
      type: z.enum(['NEED', 'OFFER']),
      categoryId: z.string().uuid().optional(),
      capabilityNames: z.array(z.string().min(1)).optional(),
      title: z.string().min(3).max(150),
      description: z.string().min(10).max(3000),
      location: z.string().max(120).optional(),
      budgetMin: z.number().nonnegative().optional(),
      budgetMax: z.number().nonnegative().optional(),
      tags: z.array(z.string().min(1).max(30)).max(20).default([]),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      visibility: z.enum(['PUBLIC', 'PRIVATE', 'VERIFIED_ONLY']).default('PUBLIC'),
      expiresAt: z.coerce.date().optional(),
    })
    .refine(
      (d) => d.budgetMin === undefined || d.budgetMax === undefined || d.budgetMin <= d.budgetMax,
      { message: 'budgetMin must be <= budgetMax', path: ['budgetMin'] }
    ),
};

const updateOpportunitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().min(10).max(3000).optional(),
    location: z.string().max(120).optional(),
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().nonnegative().optional(),
    tags: z.array(z.string().min(1).max(30)).max(20).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    visibility: z.enum(['PUBLIC', 'PRIVATE', 'VERIFIED_ONLY']).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'MATCHED', 'CLOSED', 'EXPIRED']).optional(),
    expiresAt: z.coerce.date().optional(),
  }),
};

const listOpportunitySchema = {
  query: paginationQuerySchema.extend({
    type: z.enum(['NEED', 'OFFER']).optional(),
    categoryId: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'MATCHED', 'CLOSED', 'EXPIRED']).optional(),
    location: z.string().max(120).optional(),
    tag: z.string().max(30).optional(), // filter: Opportunity.tags array contains this value
    budgetMin: z.coerce.number().nonnegative().optional(), // Opportunity.budgetMax >= budgetMin
    budgetMax: z.coerce.number().nonnegative().optional(), // Opportunity.budgetMin <= budgetMax
    search: z.string().min(1).max(150).optional(), // matches title/description (case-insensitive)
    sortBy: z.enum(['createdAt', 'budgetMin', 'budgetMax', 'priority']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

module.exports = {
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitySchema,
  idParamSchema,
};
