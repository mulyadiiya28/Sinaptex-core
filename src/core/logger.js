const loggerConfig = require('../config/logger.config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[loggerConfig.level] ?? LEVELS.info;

function redact(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const clone = { ...meta };
  loggerConfig.redactFields.forEach((field) => {
    if (field in clone) clone[field] = '[REDACTED]';
  });
  return clone;
}

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
