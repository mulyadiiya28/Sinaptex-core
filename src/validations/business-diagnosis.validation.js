const { z } = require('zod');

const startDiagnosisSchema = {
  body: z.object({
    symptomId: z.string().uuid(),
    partyId: z.string().uuid().optional(),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const submitFactorSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    factorId: z.string().uuid(),
    value: z.string().min(1).max(200),
  }),
};

const conditionSchema = z.object({
  factorId: z.string().uuid().optional(),
  factorName: z.string().optional(), // dipakai saat createKnowledge, di-resolve jadi factorId di controller
  operator: z.enum(['LT', 'LTE', 'GT', 'GTE', 'EQ', 'NEQ', 'IS_TRUE', 'IS_FALSE', 'IN']),
  value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]),
});

const createKnowledgeSchema = {
  body: z.object({
    symptom: z.object({
      name: z.string().min(3).max(200),
      description: z.string().max(1000).optional(),
    }),
    factors: z
      .array(
        z.object({
          name: z.string().min(2).max(150),
          dataType: z.enum(['NUMERIC', 'PERCENTAGE', 'BOOLEAN', 'CATEGORICAL']),
          sourceType: z.enum(['AUTO_PLATFORM', 'MANUAL_INPUT']),
          autoSourceKey: z.string().optional(),
          unit: z.string().optional(),
          order: z.number().int().optional(),
        })
      )
      .min(1),
    rootCauses: z
      .array(
        z.object({
          name: z.string().min(3).max(200),
          explanation: z.string().min(10).max(1000),
          recommendationType: z.enum(['ADVISORY_ONLY', 'MATCH_OPPORTUNITY', 'HYBRID']),
          jobId: z.string().uuid().optional(),
          rules: z
            .array(
              z.object({
                priority: z.number().int().optional(),
                conditions: z.array(conditionSchema).min(1),
              })
            )
            .optional(),
          advisoryContents: z
            .array(
              z.object({
                title: z.string().min(3).max(200),
                body: z.string().min(10).max(3000),
                authorType: z.enum(['ADMIN', 'AI_DRAFT']).optional(),
              })
            )
            .optional(),
        })
      )
      .min(1),
  }),
};

module.exports = { startDiagnosisSchema, idParamSchema, submitFactorSchema, createKnowledgeSchema };
