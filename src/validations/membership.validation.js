const { z } = require('zod');

const checkoutSchema = {
  body: z.object({
    planId: z.string().uuid(),
    voucherCode: z.string().max(50).optional(),
  }),
};

// Webhook body dari payment gateway — passthrough; keamanan di signature adapter
const webhookSchema = {
  params: z.object({
    provider: z.enum(['midtrans', 'xendit', 'duitku', 'stripe']),
  }),
  body: z.object({}).passthrough(),
};

/** Alias route tanpa :provider di path */
const webhookBodySchema = {
  body: z.object({}).passthrough(),
};

const devActivateSchema = {
  body: z.object({
    durationDays: z.number().int().positive().max(365).optional(),
  }),
};

module.exports = {
  checkoutSchema,
  webhookSchema,
  webhookBodySchema,
  devActivateSchema,
};
