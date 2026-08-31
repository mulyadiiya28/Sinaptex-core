const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

// Default production authorized frontend origins
const DEFAULT_PRODUCTION_ORIGINS = [
  'https://sinaptex.com',
  'https://app.sinaptex.com',
  'https://admin.sinaptex.com',
];

// Local development origins
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

/**
 * Parses and returns the list of allowed origins from environment and defaults.
 */
function getAllowedOrigins() {
  const envOrigins = [];

  if (process.env.ALLOWED_ORIGINS) {
    const splitOrigins = process.env.ALLOWED_ORIGINS.split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    envOrigins.push(...splitOrigins);
  }

  if (process.env.CLIENT_URL && process.env.CLIENT_URL !== '*') {
    const splitClient = process.env.CLIENT_URL.split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    envOrigins.push(...splitClient);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const baseDefaults = isProduction
    ? DEFAULT_PRODUCTION_ORIGINS
    : [...DEFAULT_PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];

  // Combine and deduplicate
  return Array.from(new Set([...baseDefaults, ...envOrigins]));
}

/**
 * Checks whether an incoming origin string matches the allowed whitelist or wildcard pattern.
 */
function isOriginAllowed(origin, customWhitelist = null) {
  if (!origin) {
    // Non-browser / same-origin / server-to-server requests without Origin header
    return true;
  }

  const whitelist = customWhitelist || getAllowedOrigins();

  // If wildcard '*' is explicitly set in non-production
  if (whitelist.includes('*')) {
    return true;
  }

  const normalizedOrigin = origin.toLowerCase().trim();

  return whitelist.some((allowed) => {
    const normalizedAllowed = allowed.toLowerCase().trim();

    // Exact match
    if (normalizedOrigin === normalizedAllowed) {
      return true;
    }

    // Wildcard subdomain matching (e.g. *.sinaptex.com or *.run.app)
    if (normalizedAllowed.startsWith('*.')) {
      const rootDomain = normalizedAllowed.slice(2);
      const escapedDomain = rootDomain.replace(/\./g, '\\.');
      const urlPattern = new RegExp(`^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`);
      return urlPattern.test(normalizedOrigin);
    }

    return false;
  });
}

/**
 * Dynamic CORS options object for express 'cors' middleware.
 */
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    logger.warn('CORS request blocked from unauthorized origin', { origin });
    return callback(
      ApiError.forbidden(
        `CORS origin '${origin}' is not authorized. Access restricted to approved domains.`,
        ErrorCodes.CORS_ORIGIN_NOT_ALLOWED
      )
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Signature',
    'X-Api-Key',
    'Idempotency-Key',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'ETag'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200,
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  corsOptions,
  DEFAULT_PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
};
