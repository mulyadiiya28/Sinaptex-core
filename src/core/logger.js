const fs = require('fs');
const path = require('path');
const loggerConfig = require('../config/logger.config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[loggerConfig.level] ?? LEVELS.info;

let dirEnsured = false;
function ensureLogDir() {
  if (dirEnsured || !loggerConfig.enableFileLogging) return;
  try {
    if (!fs.existsSync(loggerConfig.logDir)) {
      fs.mkdirSync(loggerConfig.logDir, { recursive: true });
    }
    dirEnsured = true;
  } catch (_e) {
    // Non-blocking: if directory cannot be created on read-only environments
    dirEnsured = false;
  }
}

function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        code: value.code,
      };
    }
    return value;
  });
}

function redact(meta, seen = new WeakSet()) {
  if (!meta || typeof meta !== 'object') return meta;
  if (seen.has(meta)) return '[Circular]';
  seen.add(meta);

  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
      code: meta.code,
    };
  }

  if (Array.isArray(meta)) return meta.map((item) => redact(item, seen));

  const clone = { ...meta };
  loggerConfig.redactFields.forEach((field) => {
    if (field in clone) clone[field] = '[REDACTED]';
  });

  Object.keys(clone).forEach((key) => {
    if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = redact(clone[key], seen);
    }
  });

  return clone;
}

function writeToLogFiles(level, line) {
  if (!loggerConfig.enableFileLogging) return;
  ensureLogDir();
  try {
    const combinedPath = path.join(loggerConfig.logDir, loggerConfig.combinedLogFile);
    fs.appendFile(combinedPath, `${line}\n`, () => {});

    if (level === 'error') {
      const errorPath = path.join(loggerConfig.logDir, loggerConfig.errorLogFile);
      fs.appendFile(errorPath, `${line}\n`, () => {});
    }
  } catch (_err) {
    // Non-blocking file append error catch
  }
}

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  };

  const line = safeStringify(entry);
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }

  writeToLogFiles(level, line);
}

module.exports = {
  log,
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
