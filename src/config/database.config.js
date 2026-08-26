const env = require('./env');

module.exports = {
  url: env.databaseUrl,
  provider: 'postgresql',
};
