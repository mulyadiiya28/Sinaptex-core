const { z } = require('zod');

const runMatchSchema = {
  params: z.object({ opportunityId: z.string().uuid() }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(50).default(10),
  }),
};

const createInvitationSchema = {
  body: z.object({
    matchId: z.string().uuid(),
    message: z.string().max(500).optional(),
  }),
};

const respondInvitationSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    action: z.enum(['ACCEPT', 'REJECT']),
  }),
};

const updateDealSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      status: z.enum(['NEGOTIATION', 'DEAL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED']),
      agreedTerms: z.record(z.any()).optional(),
      notes: z.string().max(1000).optional(),
      cancelReason: z.string().max(300).optional(),
    })
    .refine((d) => d.status !== 'CANCELLED' || !!d.cancelReason, {
      message: 'cancelReason is required when status is CANCELLED',
      path: ['cancelReason'],
    }),
};

module.exports = {
  runMatchSchema,
  createInvitationSchema,
  respondInvitationSchema,
  updateDealSchema,
};
