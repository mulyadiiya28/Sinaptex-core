const { z } = require('zod');

const uuid = z.string().uuid();

// Product
const createProductSchema = {
  body: z.object({
    partyId: uuid,
    categoryId: uuid.optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    price: z.number().min(0),
    currency: z.string().max(3).default('IDR'),
    stock: z.number().int().min(0).default(0),
    sku: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    variants: z.array(z.object({
      name: z.string().min(1).max(100),
      price: z.number().min(0).optional(),
      stock: z.number().int().min(0).default(0),
      sku: z.string().max(100).optional(),
    })).max(50).optional(),
  }),
};

const updateProductSchema = {
  params: z.object({ id: uuid }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    price: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    sku: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
};

const productIdParamSchema = {
  params: z.object({ id: uuid }),
};

const listProductSchema = {
  query: z.object({
    categoryId: uuid.optional(),
    partyId: uuid.optional(),
    search: z.string().max(200).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['createdAt', 'price', 'name']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

// Cart
const addCartItemSchema = {
  body: z.object({
    productId: uuid,
    variantId: uuid.optional(),
    quantity: z.number().int().min(1).max(999).default(1),
  }),
};

const updateCartItemSchema = {
  params: z.object({ itemId: uuid }),
  body: z.object({
    quantity: z.number().int().min(0).max(999),
  }),
};

const cartItemIdSchema = {
  params: z.object({ itemId: uuid }),
};

// Order
const createOrderSchema = {
  body: z.object({
    shippingAddress: z.record(z.any()).optional(),
    notes: z.string().max(1000).optional(),
  }),
};

const orderIdParamSchema = {
  params: z.object({ id: uuid }),
};

const updateOrderStatusSchema = {
  params: z.object({ id: uuid }),
  body: z.object({
    status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    trackingNumber: z.string().max(100).optional(),
  }),
};

module.exports = {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductSchema,
  addCartItemSchema,
  updateCartItemSchema,
  cartItemIdSchema,
  createOrderSchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
};
