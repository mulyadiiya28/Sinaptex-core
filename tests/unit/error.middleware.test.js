const {
  errorHandler,
  notFoundHandler,
  extractRequestContext,
} = require('../../src/middlewares/error.middleware');
const ApiError = require('../../src/utils/apiError');
const ErrorCodes = require('../../src/utils/errorCodes');
const logger = require('../../src/core/logger');

jest.mock('../../src/core/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
}));

describe('Centralized Error Handling Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      method: 'POST',
      originalUrl: '/api/v1/opportunities',
      path: '/opportunities',
      query: { filter: 'active' },
      headers: {
        'user-agent': 'Mozilla/5.0 (Node test)',
        'x-forwarded-for': '203.0.113.195',
      },
      body: {
        title: 'Need Industrial Machinery',
        password: 'super-secret-password',
        token: 'sensitive-token-abc',
      },
      user: { id: 'usr-123' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('extractRequestContext', () => {
    it('extracts request metadata and redacts sensitive body fields', () => {
      const context = extractRequestContext(req);

      expect(context.method).toBe('POST');
      expect(context.url).toBe('/api/v1/opportunities');
      expect(context.ip).toBe('203.0.113.195');
      expect(context.userAgent).toBe('Mozilla/5.0 (Node test)');
      expect(context.userId).toBe('usr-123');
      expect(context.body.password).toBe('[REDACTED]');
      expect(context.body.token).toBe('[REDACTED]');
      expect(context.body.title).toBe('Need Industrial Machinery');
    });

    it('returns empty object when req is null/undefined', () => {
      expect(extractRequestContext(null)).toEqual({});
    });
  });

  describe('errorHandler transformation and responses', () => {
    it('handles generic unhandled error, logs stack trace, and returns 500 response', () => {
      const err = new Error('Database connection failed');
      err.stack = 'Error: Database connection failed\n    at db.connect (/app/db.js:12:3)';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.INTERNAL_ERROR,
        })
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[Server Error] Database connection failed',
        expect.objectContaining({
          statusCode: 500,
          stack: expect.stringContaining('Database connection failed'),
          request: expect.objectContaining({
            method: 'POST',
            userId: 'usr-123',
          }),
        })
      );
    });

    it('transforms Prisma P2002 duplicate key constraint to 409 ApiError', () => {
      const prismaErr = {
        code: 'P2002',
        meta: { target: ['email'] },
      };

      errorHandler(prismaErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.CONFLICT,
          message: 'Duplicate value for: email',
        })
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    it('transforms Prisma P2025 not found error to 404 ApiError', () => {
      const prismaErr = {
        code: 'P2025',
      };

      errorHandler(prismaErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.NOT_FOUND,
          message: 'Related record not found',
        })
      );
    });

    it('transforms Prisma P2003 foreign key violation to 400 ApiError', () => {
      const prismaErr = {
        code: 'P2003',
      };

      errorHandler(prismaErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Foreign key constraint failed',
        })
      );
    });

    it('transforms Zod validation error into 400 Bad Request with details', () => {
      const zodErr = {
        name: 'ZodError',
        errors: [{ path: ['budgetMin'], message: 'Must be positive' }],
      };

      errorHandler(zodErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.VALIDATION_ERROR,
          details: [{ path: ['budgetMin'], message: 'Must be positive' }],
        })
      );
    });

    it('transforms JWT errors into 401 Unauthorized with SESSION_INVALID code', () => {
      const jwtErr = {
        name: 'JsonWebTokenError',
        message: 'jwt malformed',
      };

      errorHandler(jwtErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.SESSION_INVALID,
        })
      );
    });

    it('preserves existing ApiError instances without wrapping', () => {
      const apiErr = new ApiError(
        403,
        'Escrow invalid state',
        { dealId: 'deal-99' },
        ErrorCodes.ESCROW_INVALID_STATE
      );

      errorHandler(apiErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: ErrorCodes.ESCROW_INVALID_STATE,
        message: 'Escrow invalid state',
        details: { dealId: 'deal-99' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        '[Client Error 403] Escrow invalid state',
        expect.objectContaining({
          statusCode: 403,
          errorCode: ErrorCodes.ESCROW_INVALID_STATE,
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    it('returns 404 with route path in message', () => {
      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: ErrorCodes.NOT_FOUND,
        message: 'Route not found: /api/v1/opportunities',
      });
    });
  });
});
