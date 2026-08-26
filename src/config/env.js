require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(`[env] WARNING: ${name} is not set`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || '*',

  databaseUrl: required('DATABASE_URL'),

  supabase: {
    url: required('SUPABASE_URL'),
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    jwtSecret: required('SUPABASE_JWT_SECRET'),
  },

  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME'),
    apiKey: required('CLOUDINARY_API_KEY'),
    apiSecret: required('CLOUDINARY_API_SECRET'),
  },

  ranking: {
    match: Number(process.env.RANKING_WEIGHT_MATCH || 0.35),
    reputation: Number(process.env.RANKING_WEIGHT_REPUTATION || 0.15),
    response: Number(process.env.RANKING_WEIGHT_RESPONSE || 0.1),
    completion: Number(process.env.RANKING_WEIGHT_COMPLETION || 0.15),
    activity: Number(process.env.RANKING_WEIGHT_ACTIVITY || 0.05),
    verification: Number(process.env.RANKING_WEIGHT_VERIFICATION || 0.1),
    boost: Number(process.env.RANKING_WEIGHT_BOOST || 0.1),
  },
};
