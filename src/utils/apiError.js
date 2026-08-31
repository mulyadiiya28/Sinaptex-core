const ErrorCodes = require('./errorCodes');

class ApiError extends Error {
  constructor(statusCode, message, details = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    // Kode fallback generik kalau caller tidak kasih kode domain spesifik —
    // tetap konsisten dengan HTTP status supaya frontend selalu punya `code` untuk di-switch.
    this.code = code || ApiError.defaultCodeFor(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static defaultCodeFor(statusCode) {
    const map = {
      400: ErrorCodes.VALIDATION_ERROR,
      401: ErrorCodes.UNAUTHORIZED,
      402: ErrorCodes.PAYMENT_REQUIRED,
      403: ErrorCodes.FORBIDDEN,
      404: ErrorCodes.NOT_FOUND,
      409: ErrorCodes.CONFLICT,
      429: ErrorCodes.RATE_LIMITED,
      500: ErrorCodes.INTERNAL_ERROR,
    };
    return map[statusCode] || ErrorCodes.INTERNAL_ERROR;
  }

  static badRequest(message, details, code) {
    return new ApiError(400, message, details, code);
  }

  static unauthorized(message = 'Unauthorized', code = null) {
    return new ApiError(401, message, null, code);
  }

  static paymentRequired(message = 'Payment required', code = null) {
    return new ApiError(402, message, null, code);
  }

  static forbidden(message = 'Forbidden', code = null) {
    return new ApiError(403, message, null, code);
  }

  static notFound(message = 'Resource not found', code = null) {
    return new ApiError(404, message, null, code);
  }

  static conflict(message = 'Conflict', details = null, code = null) {
    return new ApiError(409, message, details, code);
  }

  static tooManyRequests(message = 'Too many requests', details = null, code = null) {
    return new ApiError(429, message, details, code || ErrorCodes.RATE_LIMITED);
  }

  static internal(message = 'Internal server error', code = null) {
    return new ApiError(500, message, null, code);
  }
}

module.exports = ApiError;
