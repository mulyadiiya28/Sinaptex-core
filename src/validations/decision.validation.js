const { z } = require('zod');

const startInquirySchema = {
  body: z.object({
    statedWant: z.string().min(3).max(500),
  }),
};

const idParamSchema = { params: z.object({ id: z.string().uuid() }) };

const submitAnswerSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    questionId: z.string().uuid(),
    answer: z.string().min(1).max(1000),
  }),
};

const createKnowledgeSchema = {
  body: z.object({
    rootProblem: z.object({
      name: z.string().min(3).max(200),
      description: z.string().max(1000).optional(),
    }),
    job: z.object({
      statement: z.string().min(10).max(500),
    }),
    solutionCategory: z.object({
      name: z.string().min(2).max(150),
      keywords: z.array(z.string().min(1).max(50)).default([]),
    }),
    relevance: z.number().min(0).max(1).optional(),
    clarifyingQuestions: z.array(z.string().min(3).max(300)).optional(),
  }),
};

module.exports = { startInquirySchema, idParamSchema, submitAnswerSchema, createKnowledgeSchema };
