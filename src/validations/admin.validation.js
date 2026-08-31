const { z } = require('zod');

const idParamSchema = {
  params: z.object({ id: z.string().uuid() }),
};

const listUsersSchema = {
  query: z.object({
    search: z.string().optional(),
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const suspendUserSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
    reason: z.string().max(500).optional(),
  }),
};

const listOpportunitiesModerationSchema = {
  query: z.object({
    status: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const forceUpdateOpportunitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'EXPIRED', 'CANCELLED']),
    moderationNote: z.string().max(1000).optional(),
  }),
};

const listReviewsModerationSchema = {
  query: z.object({
    hidden: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const setReviewVisibilitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    hidden: z.boolean(),
    hiddenReason: z.string().max(500).optional(),
  }),
};

const listReportsSchema = {
  query: z.object({
    status: z.enum(['PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const reviewReportSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['REVIEWED', 'DISMISSED', 'ACTION_TAKEN']),
    adminNote: z.string().max(1000).optional(),
  }),
};

const listTransactionsSchema = {
  query: z.object({
    status: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const updateChatRateLimitSchema = {
  body: z
    .object({
      maxNewConvFree: z.number().int().min(1).max(1000).optional(),
      maxNewConvMember: z.number().int().min(1).max(5000).optional(),
      unrepliedBurstMax: z.number().int().min(1).max(500).optional(),
      unrepliedBurstWindowMs: z.number().int().min(60_000).max(86_400_000).optional(),
      redisTtlSeconds: z.number().int().min(3600).max(7 * 24 * 3600).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'Minimal satu field harus diisi' }),
};

module.exports = {
  idParamSchema,
  listUsersSchema,
  suspendUserSchema,
  listOpportunitiesModerationSchema,
  forceUpdateOpportunitySchema,
  listReviewsModerationSchema,
  setReviewVisibilitySchema,
  listReportsSchema,
  reviewReportSchema,
  listTransactionsSchema,
  updateChatRateLimitSchema,
};
