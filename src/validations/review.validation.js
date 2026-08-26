const { z } = require('zod');

const createReviewSchema = {
  params: z.object({ dealId: z.string().uuid() }),
  body: z.object({
    revieweeId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  }),
};

module.exports = { createReviewSchema };
