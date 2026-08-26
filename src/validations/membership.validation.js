const { z } = require('zod');

const checkoutSchema = {
  body: z.object({
    planId: z.string().uuid(),
    voucherCode: z.string().max(50).optional(),
  }),
};

// Webhook body dari payment gateway — passthrough, validasi keamanan ada di
// signature check per-adapter, bukan di shape body (tiap provider beda field).
const webhookSchema = {
  params: z.object({ provider: z.enum(['midtrans', 'xendit', 'duitku', 'stripe']) }),
  body: z.object({}).passthrough(),
};

const devActivateSchema = {
  body: z.object({
    durationDays: z.number().int().positive().max(365).optional(),
  }),
};

module.exports = { checkoutSchema, webhookSchema, devActivateSchema };
