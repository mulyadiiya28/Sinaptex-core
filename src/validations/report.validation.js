const { z } = require('zod');

const createReportSchema = {
  body: z.object({
    reportedId: z.string().uuid(),
    reason: z.enum(['SPAM', 'PENIPUAN', 'KONTEN_TIDAK_PANTAS', 'PELECEHAN', 'LAINNYA']),
    description: z.string().max(1000).optional(),
  }),
};

module.exports = { createReportSchema };
