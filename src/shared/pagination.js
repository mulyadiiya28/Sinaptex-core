const { z } = require('zod');

/** Reusable Zod fragment for `?page=&limit=` query params. Merge into a schema with .extend(). */
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Prisma skip/take from a validated { page, limit } query object. */
function toSkipTake({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

/** Standard pagination meta block for apiResponse's `meta` argument. */
function buildMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { paginationQuerySchema, toSkipTake, buildMeta };
