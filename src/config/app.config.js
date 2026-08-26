const env = require('./env');

module.exports = {
  port: env.port,
  nodeEnv: env.nodeEnv,
  clientUrl: env.clientUrl,
  isProduction: env.nodeEnv === 'production',
};
