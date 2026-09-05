const errorCodes = require('./errorCodes');

function isErrorCode(val) {
  if (typeof val !== 'string') return false;
  if (errorCodes && Object.values(errorCodes).includes(val)) return true;
  return /^[A-Z0-9_]+$/.test(val);
}

function parseArgs(message, arg2, arg3, defaultCode) {
  let details = null;
  let code = defaultCode;

  if (arg3 !== undefined) {
    details = arg2;
    code = arg3 || defaultCode;
  } else if (arg2 !== undefined && arg2 !== null) {
    if (typeof arg2 === 'string') {
      if (isErrorCode(arg2)) {
        code = arg2;
      } else {
        details = arg2;
      }
    } else {
      details = arg2;
    }
  }

  return { details, code };
}

class ApiError extends Error {
  constructor(statusCode, message, details = null, code = errorCodes.INTERNAL_ERROR || 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, arg2, arg3) {
    const defaultCode = errorCodes.VALIDATION_ERROR || 'VALIDATION_ERROR';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(400, message, details, code);
  }

  static unauthorized(message, arg2, arg3) {
    const defaultCode = errorCodes.UNAUTHORIZED || 'UNAUTHORIZED';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(401, message, details, code);
  }

  static paymentRequired(message, arg2, arg3) {
    const defaultCode = errorCodes.PAYMENT_REQUIRED || 'PAYMENT_REQUIRED';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(402, message, details, code);
  }

  static forbidden(message, arg2, arg3) {
    const defaultCode = errorCodes.FORBIDDEN || 'FORBIDDEN';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(403, message, details, code);
  }

  static notFound(message, arg2, arg3) {
    const defaultCode = errorCodes.NOT_FOUND || 'NOT_FOUND';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(404, message, details, code);
  }

  static conflict(message, arg2, arg3) {
    const defaultCode = errorCodes.CONFLICT || 'CONFLICT';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(409, message, details, code);
  }

  static internal(message, arg2, arg3) {
    const defaultCode = errorCodes.INTERNAL_ERROR || 'INTERNAL_ERROR';
    const { details, code } = parseArgs(message, arg2, arg3, defaultCode);
    return new ApiError(500, message, details, code);
  }
}

module.exports = ApiError;