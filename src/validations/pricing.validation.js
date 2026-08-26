const { z } = require('zod');

const planIdParamSchema = { params: z.object({ planId: z.string().uuid() }) };

const setPlanPriceSchema = {
  params: z.object({ planId: z.string().uuid() }),
  body: z.object({
    price: z.number().positive(),
    currency: z.string().length(3).optional(),
  }),
};

module.exports = { planIdParamSchema, setPlanPriceSchema };
