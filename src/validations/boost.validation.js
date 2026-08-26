const { z } = require('zod');

const activateBoostSchema = {
  params: z.object({ opportunityId: z.string().uuid() }),
  body: z.object({
    planType: z.enum(['FREE', 'BASIC', 'PREMIUM', 'VIP']),
    // In real life, paymentStatus would come from a payment gateway webhook.
    paymentStatus: z.enum(['PENDING', 'PAID']).default('PENDING'),
  }),
};

module.exports = { activateBoostSchema };
