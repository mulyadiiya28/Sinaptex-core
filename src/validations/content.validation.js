const { z } = require('zod');

const slugParamSchema = {
  params: z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug harus kebab-case') }),
};

const upsertPageSchema = {
  params: z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }),
  body: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const createFaqSchema = {
  body: z.object({
    question: z.string().min(3).max(300),
    answer: z.string().min(3).max(3000),
    order: z.number().int().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  }),
};

const updateFaqSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    question: z.string().min(3).max(300).optional(),
    answer: z.string().min(3).max(3000).optional(),
    order: z.number().int().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  }),
};

module.exports = { slugParamSchema, upsertPageSchema, idParamSchema, createFaqSchema, updateFaqSchema };
