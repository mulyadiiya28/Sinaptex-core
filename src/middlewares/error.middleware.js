const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

/**
 * Extracts sanitized request diagnostic metadata for error tracking.
 *
 * @param {import('express').Request} req
 * @returns {object}
 */
function extractRequestContext(req) {
  if (!req) return {};

  const headers = req.headers || {};
  const body = req.body && typeof req.body === 'object' ? { ...req.body } : req.body;

  // Mask common sensitive fields in body
  if (body && typeof body === 'object') {
    ['password', 'token', 'authorization', 'accessToken', 'secret'].forEach((key) => {
      if (key in body) body[key] = '[REDACTED]';
    });
  }

  return {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || headers['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: headers['user-agent'],
    userId: req.user?.id || req.supabaseUser?.id || req.profile?.id || undefined,
    body: body && Object.keys(body).length > 0 ? body : undefined,
  };
}

/**
 * Centralized error handler middleware.
 * Maps known ORM/database, auth, and validation errors, logs full stack traces
 * to structured log files and stderr, and returns standardized API error responses.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // 1. Prisma database error transformations
  if (error.code === 'P2002') {
    const target = error.meta?.target ? `: ${error.meta.target.join(', ')}` : '';
    error = ApiError.conflict(`Duplicate value for${target}`);
  } else if (error.code === 'P2025') {
    error = ApiError.notFound('Related record not found');
  } else if (error.code === 'P2003') {
    error = ApiError.badRequest('Foreign key constraint failed', null, ErrorCodes.VALIDATION_ERROR);
  } else if (error.name === 'ZodError') {
    error = ApiError.badRequest('Validation failed', error.errors, ErrorCodes.VALIDATION_ERROR);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Invalid or expired authentication token', ErrorCodes.SESSION_INVALID);
  } else if (!(error instanceof ApiError)) {
    // Wrap unknown/unhandled exceptions into 500 ApiError
    const isProd = process.env.NODE_ENV === 'production';
    const message = isProd ? 'Internal server error' : error.message || 'Internal server error';
    error = ApiError.internal(message);
  }

  const statusCode = error.statusCode || 500;
  const isInternal = statusCode >= 500;

  // 2. Structured diagnostic metadata for easy debugging in shared hosting environments
  const errorMeta = {
    errorName: err.name || 'Error',
    errorMessage: err.message,
    errorCode: error.code || ErrorCodes.INTERNAL_ERROR,
    statusCode,
    stack: err.stack,
    request: extractRequestContext(req),
    timestamp: new Date().toISOString(),
  };

  // 3. Log to structured log sink (writes to console and logs/error.log + logs/combined.log)
  if (isInternal) {
    logger.error(`[Server Error] ${err.message || error.message}`, errorMeta);
  } else {
    logger.warn(`[Client Error ${statusCode}] ${error.message}`, errorMeta);
  }

  // 4. Return sanitized client response
  const responsePayload = {
    success: false,
    code: error.code || ErrorCodes.INTERNAL_ERROR,
    message: error.message,
  };

  if (error.details !== undefined && error.details !== null) {
    responsePayload.details = error.details;
  }

  // In non-production, attach debug stack trace if internal error
  if (process.env.NODE_ENV !== 'production' && isInternal && err.stack) {
    responsePayload.debug = {
      stack: err.stack.split('\n').map((line) => line.trim()),
    };
  }

  res.status(statusCode).json(responsePayload);
}

/**
 * 404 Route Not Found middleware.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: ErrorCodes.NOT_FOUND,
    message: `Route not found: ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  extractRequestContext,
};
