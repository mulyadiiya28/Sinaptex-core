const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Prisma known errors -> friendlier messages (checked on the RAW thrown error,
  // before it's wrapped into ApiError — Prisma's own `.code` like "P2002" is
  // unrelated to ApiError's `.code` used for the frontend-facing error registry).
  if (error.code === 'P2002') {
    error = ApiError.conflict(`Duplicate value for: ${error.meta?.target?.join(', ')}`);
  } else if (error.code === 'P2025') {
    error = ApiError.notFound('Related record not found');
  } else if (!(error instanceof ApiError)) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
    error = ApiError.internal(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    );
  }

  res.status(error.statusCode).json({
    success: false,
    code: error.code || ErrorCodes.INTERNAL_ERROR,
    message: error.message,
    details: error.details || undefined,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, code: ErrorCodes.NOT_FOUND, message: `Route not found: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
