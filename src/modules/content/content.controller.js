const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const cache = require('../../core/cache');
const cacheConfig = require('../../config/cache.config');

async function invalidateContentCaches(slug) {
  await cache.del(cacheConfig.keys.contentFaq);
  if (slug) await cache.del(cacheConfig.keys.contentPage(slug));
}

const getPublicPage = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const page = await cache.getOrSet(
    cacheConfig.keys.contentPage(slug),
    async () => {
      const row = await prisma.staticPage.findFirst({
        where: { slug, status: 'PUBLISHED' },
      });
      return row || null;
    },
    cacheConfig.ttl.contentPage
  );

  if (!page) throw ApiError.notFound('Page not found');
  return success(res, page);
});

const listPublicFaq = asyncHandler(async (req, res) => {
  const faqs = await cache.getOrSet(
    cacheConfig.keys.contentFaq,
    () =>
      prisma.faqItem.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { order: 'asc' },
      }),
    cacheConfig.ttl.contentFaq
  );
  return success(res, faqs);
});

const listPagesAdmin = asyncHandler(async (req, res) => {
  const pages = await prisma.staticPage.findMany({ orderBy: { slug: 'asc' } });
  return success(res, pages);
});

const getPageAdmin = asyncHandler(async (req, res) => {
  const page = await prisma.staticPage.findUnique({ where: { slug: req.params.slug } });
  if (!page) throw ApiError.notFound('Page not found');
  return success(res, page);
});

const upsertPage = asyncHandler(async (req, res) => {
  const { title, content, status } = req.body;
  const page = await prisma.staticPage.upsert({
    where: { slug: req.params.slug },
    update: { title, content, status, updatedBy: req.profile.id },
    create: {
      slug: req.params.slug,
      title,
      content,
      status: status || 'DRAFT',
      updatedBy: req.profile.id,
    },
  });
  await invalidateContentCaches(req.params.slug);
  return success(res, page, 'Page saved');
});

const listFaqAdmin = asyncHandler(async (req, res) => {
  const faqs = await prisma.faqItem.findMany({ orderBy: { order: 'asc' } });
  return success(res, faqs);
});

const createFaq = asyncHandler(async (req, res) => {
  const faq = await prisma.faqItem.create({ data: req.body });
  await invalidateContentCaches();
  return created(res, faq, 'FAQ item created');
});

const updateFaq = asyncHandler(async (req, res) => {
  const existing = await prisma.faqItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('FAQ item not found');

  const faq = await prisma.faqItem.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await invalidateContentCaches();
  return success(res, faq, 'FAQ item updated');
});

const deleteFaq = asyncHandler(async (req, res) => {
  const existing = await prisma.faqItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('FAQ item not found');

  await prisma.faqItem.delete({ where: { id: req.params.id } });
  await invalidateContentCaches();
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
