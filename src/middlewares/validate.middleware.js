const ApiError = require('../utils/apiError');

/**
 * validate({ body, query, params }) - each is an optional Zod schema.
 * Parsed + coerced values are written back onto req so controllers get clean data.
 */
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    if (err.name === 'ZodError') {
      const details = err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    next(err);
  }
};

module.exports = validate;
