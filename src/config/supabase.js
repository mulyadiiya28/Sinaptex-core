const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Service-role client: used server-side only (never expose to client apps)
const supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabaseAdmin };
