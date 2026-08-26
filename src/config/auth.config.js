const env = require('./env');

module.exports = {
  provider: 'supabase',
  supabaseUrl: env.supabase.url,
  jwtSecret: env.supabase.jwtSecret,
  // How auth is resolved: Bearer token from Supabase Auth, verified server-side per request.
  bearerHeader: 'authorization',
};
