const { z } = require('zod');

const checkoutBoostSchema = {
  params: z.object({ opportunityId: z.string().uuid() }),
  body: z.object({
    planType: z.enum(['FREE', 'BASIC', 'PREMIUM', 'VIP']),
    // paymentStatus TIDAK diterima dari client — hanya webhook gateway yang mengaktifkan berbayar
  }),
};

/** @deprecated alias — pakai checkoutBoostSchema */
const activateBoostSchema = checkoutBoostSchema;

module.exports = { checkoutBoostSchema, activateBoostSchema };
