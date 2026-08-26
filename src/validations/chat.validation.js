const { z } = require('zod');
const { paginationQuerySchema } = require('../shared/pagination');

const startConversationSchema = {
  body: z.object({
    recipientProfileId: z.string().uuid(),
    originType: z.enum(['PROFILE', 'NEED', 'OFFER']).default('PROFILE'),
    opportunityId: z.string().uuid().optional(),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const getMessagesSchema = {
  params: z.object({ id: z.string().uuid() }),
  query: paginationQuerySchema,
};

const sendMessageSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    type: z.enum(['TEXT', 'IMAGE', 'ATTACHMENT']).default('TEXT'),
    content: z.string().max(2000).optional(),
  }),
};

module.exports = { startConversationSchema, idParamSchema, getMessagesSchema, sendMessageSchema };
