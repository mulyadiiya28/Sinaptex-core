const { z } = require('zod');
const { paginationQuerySchema } = require('../shared/pagination');

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const listUsersSchema = {
  query: paginationQuerySchema.extend({
    search: z.string().max(150).optional(),
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  }),
};

const suspendUserSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
      reason: z.string().max(500).optional(),
    })
    .refine((d) => d.accountStatus === 'ACTIVE' || !!d.reason, {
      message: 'reason wajib diisi kalau accountStatus bukan ACTIVE',
      path: ['reason'],
    }),
};

const listOpportunitiesModerationSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['DRAFT', 'ACTIVE', 'MATCHED', 'CLOSED', 'EXPIRED']).optional(),
  }),
};

const forceUpdateOpportunitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['DRAFT', 'ACTIVE', 'MATCHED', 'CLOSED', 'EXPIRED']),
    moderationNote: z.string().max(500).optional(),
  }),
};

const listReviewsModerationSchema = {
  query: paginationQuerySchema.extend({
    hidden: z.enum(['true', 'false']).optional(),
  }),
};

const setReviewVisibilitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      hidden: z.boolean(),
      hiddenReason: z.string().max(300).optional(),
    })
    .refine((d) => !d.hidden || !!d.hiddenReason, {
      message: 'hiddenReason wajib diisi kalau hidden = true',
      path: ['hiddenReason'],
    }),
};

const listReportsSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN']).optional(),
  }),
};

const reviewReportSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['REVIEWED', 'DISMISSED', 'ACTION_TAKEN']),
    adminNote: z.string().max(500).optional(),
  }),
};

const listTransactionsSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']).optional(),
  }),
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
};
