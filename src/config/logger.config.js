const env = require('./env');

module.exports = {
  level: process.env.LOG_LEVEL || (env.nodeEnv === 'production' ? 'info' : 'debug'),
  // morgan format dipakai saat ini di app.js; kolom di bawah untuk saat pindah ke pino/winston
  httpFormat: env.nodeEnv === 'development' ? 'dev' : 'combined',
  redactFields: ['password', 'token', 'authorization', 'accessToken'],
};
