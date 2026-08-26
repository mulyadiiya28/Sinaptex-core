const { z } = require('zod');

const updateProfileSchema = {
  body: z.object({
    fullName: z.string().min(2).max(120).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
  }),
};

const idParamSchema = {
  params: z.object({ id: z.string().uuid() }),
};

module.exports = { updateProfileSchema, idParamSchema };
