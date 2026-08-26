const { z } = require('zod');
const { paginationQuerySchema } = require('../shared/pagination');

const listFraudFlagsSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['PENDING_REVIEW', 'CONFIRMED', 'DISMISSED']).optional(),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const reviewFraudFlagSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['CONFIRMED', 'DISMISSED']),
    note: z.string().max(1000).optional(),
  }),
};

module.exports = { listFraudFlagsSchema, idParamSchema, reviewFraudFlagSchema };
