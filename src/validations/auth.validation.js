const { z } = require('zod');

// Called right after Supabase Auth sign-up/sign-in on the client,
// to create the mirrored User + Profile (+ optional Party & Role) in our DB.
const registerSchema = {
  body: z.object({
    fullName: z.string().min(2).max(120),
    phone: z.string().min(8).max(20).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    party: z
      .object({
        name: z.string().min(2).max(150),
        isCompany: z.boolean().default(true),
        categoryId: z.string().uuid().optional(),
        description: z.string().max(1000).optional(),
        location: z.string().max(120).optional(),
        npwp: z.string().max(40).optional(),
        nib: z.string().max(40).optional(),
      })
      .optional(),
    businessRoles: z
      .array(z.enum(['BUYER', 'SUPPLIER', 'INVESTOR', 'STARTUP', 'PARTNER']))
      .min(1)
      .default(['BUYER']),
    capabilityNames: z.array(z.string().min(1)).optional(),
  }),
};

const loginSyncSchema = {
  // No body needed: identity comes entirely from the verified Supabase bearer token.
  body: z.object({}).optional(),
};

module.exports = { registerSchema, loginSyncSchema };
