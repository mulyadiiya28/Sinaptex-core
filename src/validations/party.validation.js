const { z } = require('zod');

const createPartySchema = {
  body: z.object({
    name: z.string().min(2).max(150),
    isCompany: z.boolean().default(true),
    categoryId: z.string().uuid().optional(),
    description: z.string().max(1000).optional(),
    location: z.string().max(120).optional(),
    npwp: z.string().max(40).optional(),
    nib: z.string().max(40).optional(),
    capabilityNames: z.array(z.string().min(1)).optional(),
    businessRoles: z.array(z.enum(['BUYER', 'SUPPLIER', 'INVESTOR', 'STARTUP', 'PARTNER'])).optional(),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const updatePartySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    categoryId: z.string().uuid().optional(),
    description: z.string().max(1000).optional(),
    location: z.string().max(120).optional(),
    logoUrl: z.string().url().optional(),
    npwp: z.string().max(40).optional(),
    nib: z.string().max(40).optional(),
  }),
};

const addCapabilitySchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ name: z.string().min(1).max(100) }),
};

const removeCapabilitySchema = {
  params: z.object({ id: z.string().uuid(), capabilityId: z.string().uuid() }),
};

module.exports = {
  createPartySchema,
  idParamSchema,
  updatePartySchema,
  addCapabilitySchema,
  removeCapabilitySchema,
};
