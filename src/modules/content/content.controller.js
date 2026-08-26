const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

// ---------- Public (hanya PUBLISHED) ----------

const getPublicPage = asyncHandler(async (req, res) => {
  const page = await prisma.staticPage.findFirst({
    where: { slug: req.params.slug, status: 'PUBLISHED' },
  });
  if (!page) throw ApiError.notFound('Page not found');
  return success(res, page);
});

const listPublicFaq = asyncHandler(async (req, res) => {
  const faqs = await prisma.faqItem.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { order: 'asc' },
  });
  return success(res, faqs);
});

// ---------- Admin (semua status) ----------

const listPagesAdmin = asyncHandler(async (req, res) => {
  const pages = await prisma.staticPage.findMany({ orderBy: { slug: 'asc' } });
  return success(res, pages);
});

const getPageAdmin = asyncHandler(async (req, res) => {
  const page = await prisma.staticPage.findUnique({ where: { slug: req.params.slug } });
  if (!page) throw ApiError.notFound('Page not found');
  return success(res, page);
});

/** Upsert: admin kelola set slug yang sudah ditentukan, tidak perlu create/update endpoint terpisah. */
const upsertPage = asyncHandler(async (req, res) => {
  const { title, content, status } = req.body;
  const page = await prisma.staticPage.upsert({
    where: { slug: req.params.slug },
    update: { title, content, status, updatedBy: req.profile.id },
    create: { slug: req.params.slug, title, content, status: status || 'DRAFT', updatedBy: req.profile.id },
  });
  return success(res, page, 'Page saved');
});

const listFaqAdmin = asyncHandler(async (req, res) => {
  const faqs = await prisma.faqItem.findMany({ orderBy: { order: 'asc' } });
  return success(res, faqs);
});

const createFaq = asyncHandler(async (req, res) => {
  const faq = await prisma.faqItem.create({ data: req.body });
  return created(res, faq, 'FAQ item created');
});

const updateFaq = asyncHandler(async (req, res) => {
  const existing = await prisma.faqItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('FAQ item not found');

  const faq = await prisma.faqItem.update({ where: { id: req.params.id }, data: req.body });
  return success(res, faq, 'FAQ item updated');
});

const deleteFaq = asyncHandler(async (req, res) => {
  const existing = await prisma.faqItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('FAQ item not found');

  await prisma.faqItem.delete({ where: { id: req.params.id } });
  return success(res, null, 'FAQ item deleted');
});

module.exports = {
  getPublicPage,
  listPublicFaq,
  listPagesAdmin,
  getPageAdmin,
  upsertPage,
  listFaqAdmin,
  createFaq,
  updateFaq,
  deleteFaq,
};
