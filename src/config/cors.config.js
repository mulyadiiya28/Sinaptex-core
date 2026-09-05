// src/config/cors.config.js
const ApiError = require('../utils/ApiError'); // Change from 'apiError' to 'ApiError'
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

const DEFAULT_PRODUCTION_ORIGINS = [
  'https://sinaptex.com',
  'https://app.sinaptex.com',
  'https://admin.sinaptex.com',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAllowedOrigins() {
  const envOrigins = [];
  if (process.env.ALLOWED_ORIGINS) {
    envOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map((i) => i.trim()).filter(Boolean));
  }
  if (process.env.CLIENT_URL && process.env.CLIENT_URL !== '*') {
    envOrigins.push(...process.env.CLIENT_URL.split(',').map((i) => i.trim()).filter(Boolean));
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const baseDefaults = isProduction
    ? DEFAULT_PRODUCTION_ORIGINS
    : [...DEFAULT_PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];

  return Array.from(new Set([...baseDefaults, ...envOrigins]));
}

function compileRules(rawOrigins) {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowWildcard = !isProduction && rawOrigins.includes('*');
  const exactMatches = new Set();
  const patterns = [];

  for (const allowed of rawOrigins) {
    if (!allowed) continue;
    const normalized = allowed.toLowerCase().trim();
    if (normalized === '*') continue;

    let domain = normalized;
    if (domain.startsWith('https://')) domain = domain.slice(8);
    if (domain.startsWith('http://')) domain = domain.slice(7);

    if (domain.startsWith('*.')) {
      const rootDomain = domain.slice(2);
      const escapedDomain = escapeRegex(rootDomain);
      patterns.push(new RegExp(`^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`));
    } else {
      exactMatches.add(normalized);
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        exactMatches.add(`https://${normalized}`);
        exactMatches.add(`http://${normalized}`);
      }
    }
  }

  return { allowWildcard, exactMatches, patterns };
}

function getCorsRules() {
  return compileRules(getAllowedOrigins());
}

function isOriginAllowed(origin, customRules = null) {
  if (!origin) return true;

  let rules;
  if (Array.isArray(customRules)) {
    rules = compileRules(customRules);
  } else if (customRules && typeof customRules === 'object') {
    rules = customRules;
  } else {
    rules = getCorsRules();
  }

  if (rules.allowWildcard) return true;

  const normalizedOrigin = origin.toLowerCase().trim();

  if (rules.exactMatches && rules.exactMatches.has && rules.exactMatches.has(normalizedOrigin)) {
    return true;
  }

  if (Array.isArray(rules.patterns)) {
    return rules.patterns.some((pattern) => pattern.test(normalizedOrigin));
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked from unauthorized origin', { meta: { origin } });
      const error = ApiError.forbidden(
        `CORS origin not allowed: ${origin}`,
        null,
        ErrorCodes.CORS_ORIGIN_NOT_ALLOWED || 'CORS_ORIGIN_NOT_ALLOWED'
      );
      callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Correlation-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400,
};

module.exports = {
  getAllowedOrigins,
  getCorsRules,
  isOriginAllowed,
  corsOptions,
  DEFAULT_PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
};