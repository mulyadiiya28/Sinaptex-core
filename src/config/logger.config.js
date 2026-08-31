const path = require('path');
const env = require('./env');

module.exports = {
  level: process.env.LOG_LEVEL || (env.nodeEnv === 'production' ? 'info' : 'debug'),
  // morgan format dipakai saat ini di app.js; kolom di bawah untuk saat pindah ke pino/winston
  httpFormat: env.nodeEnv === 'development' ? 'dev' : 'combined',
  redactFields: [
    'password',
    'token',
    'authorization',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cvv',
  ],
  logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
  errorLogFile: process.env.ERROR_LOG_FILE || 'error.log',
  combinedLogFile: process.env.COMBINED_LOG_FILE || 'combined.log',
  enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
};
