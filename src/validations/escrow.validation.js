const { z } = require('zod');

const initiateHoldSchema = {
  body: z.object({
    buyerPartyId: z.string().uuid(),
    sellerPartyId: z.string().uuid(),
    amount: z.number().positive(),
    fee: z.number().nonnegative().optional().default(0),
    currency: z.string().max(10).optional().default('IDR'),
    dealId: z.string().uuid().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
  }),
};

const escrowIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

const sellerConfirmSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      notes: z.string().max(1000).optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
};

const buyerConfirmSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      notes: z.string().max(1000).optional(),
      autoRelease: z.boolean().optional().default(false),
    })
    .optional(),
};

const releaseFundsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      notes: z.string().max(1000).optional(),
    })
    .optional(),
};

const refundSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      reason: z.string().min(3).max(500).optional().default('Mutual cancellation'),
    })
    .optional(),
};

const disputeSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    disputeReason: z.string().min(5).max(1000),
  }),
};

const listEscrowsSchema = {
  query: z
    .object({
      partyId: z.string().uuid().optional(),
      status: z
        .enum([
          'PENDING_HOLD',
          'HELD',
          'BUYER_CONFIRMED',
          'SELLER_CONFIRMED',
          'RELEASED',
          'REFUNDED',
          'DISPUTED',
          'CANCELLED',
        ])
        .optional(),
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().positive().max(100).optional().default(20),
    })
    .optional(),
};

module.exports = {
  initiateHoldSchema,
  escrowIdParamSchema,
  sellerConfirmSchema,
  buyerConfirmSchema,
  releaseFundsSchema,
  refundSchema,
  disputeSchema,
  listEscrowsSchema,
};
