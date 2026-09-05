const ApiError = require('../utils/apiError'); 
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'otp',
  'cvv',
  'cardnumber',
  'pin',
]);

/**
 * Checks if a value is a plain JavaScript object (excluding Date, Buffer, RegExp, etc.)
 */
function isPlainObject(val) {
  if (Object.prototype.toString.call(val) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Recursively redact sensitive keys from objects/arrays.
 * Depth-limited to avoid pathological nesting.
 *
 * @param {*} value
 * @param {number} [depth=0]
 * @returns {*}
 */
function redact(value, depth = 0) {
  if (depth > 5 || value == null) return value;

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }

  if (isPlainObject(value)) {
    const redactedObj = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
        redactedObj[key] = '[REDACTED]';
      } else {
        redactedObj[key] = redact(val, depth + 1);
      }
    }
    return redactedObj;
  }

  return value;
}

/**
 * Extracts sanitized request diagnostic metadata for error tracking.
 *
 * @param {import('express').Request} req
 * @returns {object}
 */
function extractRequestContext(req) {
  if (!req) return {};

  const headers = req.headers || {};
  const forwardedFor = headers['x-forwarded-for'];
  const rawIp =
    req.ip ||
    (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : undefined) ||
    req.socket?.remoteAddress;

  const body =
    req.body && typeof req.body === 'object' ? redact({ ...req.body }) : undefined;
  const query =
    req.query && typeof req.query === 'object' ? redact({ ...req.query }) : undefined;

  return {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: query && Object.keys(query).length > 0 ? query : undefined,
    ip: rawIp,
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

  // 1. Express body-parser invalid JSON syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = ApiError.badRequest(
      'Invalid JSON syntax in request body',
      null,
      ErrorCodes.VALIDATION_ERROR
    );
  }
  // 2. Prisma database error transformations
  else if (error.name === 'PrismaClientKnownRequestError' || error.code?.startsWith('P')) {
    if (error.code === 'P2002') {
      const target = error.meta?.target
        ? `: ${Array.isArray(error.meta.target) ? error.meta.target.join(', ') : error.meta.target}`
        : '';
      error = ApiError.conflict(`Duplicate value for${target}`, null, ErrorCodes.CONFLICT);
    } else if (error.code === 'P2025') {
      error = ApiError.notFound('Related record not found', null, ErrorCodes.NOT_FOUND);
    } else if (error.code === 'P2003') {
      error = ApiError.badRequest(
        'Foreign key constraint failed',
        null,
        ErrorCodes.VALIDATION_ERROR
      );
    } else {
      error = ApiError.badRequest(
        'Database request error',
        null,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }
  // 3. Schema & Auth error transformations
  else if (error.name === 'ZodError') {
    error = ApiError.badRequest(
      'Validation failed',
      error.issues || error.errors,
      ErrorCodes.VALIDATION_ERROR
    );
  } else if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError' ||
    error.name === 'NotBeforeError'
  ) {
    error = ApiError.unauthorized(
      'Invalid or expired authentication token',
      null,
      ErrorCodes.SESSION_INVALID || 'SESSION_INVALID'
    );
  }
  // 4. Wrap generic or unhandled exceptions into ApiError
  else if (!(error instanceof ApiError)) {
    const statusCode = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === 'production';
    const message =
      isProd && statusCode >= 500
        ? 'Internal server error'
        : err.message || 'Internal server error';

    error = new ApiError(
      statusCode,
      message,
      null,
      err.code || ErrorCodes.INTERNAL_ERROR
    );
  }

  const statusCode = error.statusCode || 500;
  const isInternal = statusCode >= 500;

  // 5. Structured diagnostic metadata
  const errorMeta = {
    errorName: err.name || 'Error',
    errorMessage: err.message,
    errorCode: error.code || ErrorCodes.INTERNAL_ERROR,
    statusCode,
    stack: err.stack,
    request: extractRequestContext(req),
    timestamp: new Date().toISOString(),
  };

  // 6. Structured logging output
  if (isInternal) {
    logger.error(`[Server Error] ${err.message || error.message}`, errorMeta);
  } else {
    logger.warn(`[Client Error ${statusCode}] ${error.message}`, errorMeta);
  }

  // 7. Standardized client response payload
  const responsePayload = {
    success: false,
    code: error.code || ErrorCodes.INTERNAL_ERROR,
    message: error.message,
  };

  if (error.details !== undefined && error.details !== null) {
    responsePayload.details = error.details;
  }

  // Include stack trace in non-production environments for internal errors
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
  redact,
};