const { z } = require('zod');

const submitIntentSchema = {
  body: z.object({
    text: z.string().min(3).max(500),
    partyId: z.string().uuid().optional(),
  }),
};

module.exports = { submitIntentSchema };
