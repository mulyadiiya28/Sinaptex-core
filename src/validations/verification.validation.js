const { z } = require('zod');

const uploadDocumentSchema = {
  body: z.object({
    type: z.enum(['KTP', 'NIB', 'NPWP', 'SERTIFIKAT', 'LAINNYA']),
    partyId: z.string().uuid().optional(), // omit = attach to caller's own profile
  }),
};

const reviewDocumentSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['VERIFIED', 'REJECTED']),
    rejectReason: z.string().max(300).optional(),
  }).refine((d) => d.status !== 'REJECTED' || !!d.rejectReason, {
    message: 'rejectReason is required when status is REJECTED',
    path: ['rejectReason'],
  }),
};

module.exports = { uploadDocumentSchema, reviewDocumentSchema };
