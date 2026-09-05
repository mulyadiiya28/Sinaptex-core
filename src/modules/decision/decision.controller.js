const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const decisionService = require('./decision.service');

// ---------- Public inquiry flow ----------

const startInquiry = asyncHandler(async (req, res) => {
  const { statedWant } = req.body;
  const result = await decisionService.startInquiry({ statedWant, profileId: req.profile?.id });
  return created(res, result, 'Inquiry started');
});

const getInquiry = asyncHandler(async (req, res) => {
  const inquiry = await prisma.decisionInquiry.findUnique({
    where: { id: req.params.id },
    include: { diagnosedJob: true, matchedSolutionCategory: true, answers: true },
  });
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  return success(res, inquiry);
});

const submitAnswer = asyncHandler(async (req, res) => {
  const { questionId, answer } = req.body;
  try {
    const result = await decisionService.submitAnswer({ inquiryId: req.params.id, questionId, answer });
    return success(res, result, 'Answer recorded');
  } catch (err) {
    throw ApiError.conflict(err.message);
  }
});

const getRecommendations = asyncHandler(async (req, res) => {
  try {
    const result = await decisionService.getRecommendations(req.params.id);
    return success(res, result);
  } catch (err) {
    throw ApiError.conflict(err.message);
  }
});

// ---------- Admin: knowledge-base management ----------
// Basis pengetahuan (RootProblem/JobToBeDone/SolutionCategory) sengaja dikelola
// manual oleh admin (bukan digenerate AI) supaya tetap jadi aset terstruktur
// yang bisa diaudit dan tidak berubah-ubah mengikuti model AI yang dipakai.

const createKnowledge = asyncHandler(async (req, res) => {
  const { rootProblem, job, solutionCategory, relevance, clarifyingQuestions } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const problem = await tx.rootProblem.upsert({
      where: { name: rootProblem.name },
      update: { description: rootProblem.description },
      create: rootProblem,
    });

    const createdJob = await tx.jobToBeDone.create({
      data: { rootProblemId: problem.id, statement: job.statement },
    });

    if (clarifyingQuestions?.length) {
      await tx.clarifyingQuestion.createMany({
        data: clarifyingQuestions.map((q, i) => ({ jobId: createdJob.id, question: q, order: i })),
      });
    }

    const category = await tx.solutionCategory.upsert({
      where: { name: solutionCategory.name },
      update: { keywords: solutionCategory.keywords },
      create: solutionCategory,
    });

    await tx.solutionCategoryJob.upsert({
      where: { solutionCategoryId_jobId: { solutionCategoryId: category.id, jobId: createdJob.id } },
      update: { relevance: relevance ?? 1 },
      create: { solutionCategoryId: category.id, jobId: createdJob.id, relevance: relevance ?? 1 },
    });

    return tx.jobToBeDone.findUnique({
      where: { id: createdJob.id },
      // eslint-disable-next-line max-len
      include: { rootProblem: true, clarifyingQuestions: true, solutionMappings: { include: { solutionCategory: true } } },
    });
  });

  return created(res, result, 'Knowledge entry created');
});

const listKnowledge = asyncHandler(async (req, res) => {
  const categories = await prisma.solutionCategory.findMany({
    include: {
      jobMappings: {
        include: { job: { include: { rootProblem: true, clarifyingQuestions: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
  return success(res, categories);
});

module.exports = {
  startInquiry,
  getInquiry,
  submitAnswer,
  getRecommendations,
  createKnowledge,
  listKnowledge,
};
