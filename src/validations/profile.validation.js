const { z } = require('zod');

const updateProfileSchema = {
  body: z.object({
    fullName: z.string().min(2).max(120).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    phone: z.string().min(5).max(30).optional(),
    avatarUrl: z.string().url().max(500).optional(),
    profileType: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
  }),
};

const idParamSchema = {
  params: z.object({ id: z.string().uuid() }),
};

const mediaParamSchema = {
  params: z.object({
    mediaId: z.string().uuid(),
  }),
};

module.exports = {
  updateProfileSchema,
  idParamSchema,
  mediaParamSchema,
};
