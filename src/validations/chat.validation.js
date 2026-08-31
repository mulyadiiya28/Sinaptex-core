const { z } = require('zod');

const startConversationSchema = {
  body: z.object({
    recipientProfileId: z.string().uuid(),
    originType: z.enum(['PROFILE', 'NEED', 'OFFER']).default('PROFILE'),
    opportunityId: z.string().uuid().optional(),
  }),
};

const idParamSchema = {
  params: z.object({ id: z.string().uuid() }),
};

const getMessagesSchema = {
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

const sendMessageSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    type: z.enum(['TEXT', 'IMAGE', 'ATTACHMENT']).optional(),
    content: z.string().max(5000).optional(),
  }),
};

const reportPeerSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.enum(['SPAM', 'PENIPUAN', 'KONTEN_TIDAK_PANTAS', 'PELECEHAN', 'LAINNYA']),
    description: z.string().max(1000).optional(),
  }),
};

module.exports = {
  startConversationSchema,
  idParamSchema,
  getMessagesSchema,
  sendMessageSchema,
  reportPeerSchema,
};
