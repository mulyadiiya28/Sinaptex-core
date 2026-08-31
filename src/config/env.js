require('dotenv').config();

function required(name, fallback = '') {
  const value = process.env[name] || fallback;
  if (!value && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(`[env] WARNING: ${name} is not set`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'https://sinaptex.com',
  allowedOrigins: process.env.ALLOWED_ORIGINS || '',

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/sinaptex'),

  supabase: {
    url: required('SUPABASE_URL', 'https://mock.supabase.co'),
    anonKey: required('SUPABASE_ANON_KEY', 'mock-anon-key'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-role-key'),
    jwtSecret: required('SUPABASE_JWT_SECRET', 'mock-jwt-secret'),
  },

  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME', 'mock-cloud'),
    apiKey: required('CLOUDINARY_API_KEY', 'mock-api-key'),
    apiSecret: required('CLOUDINARY_API_SECRET', 'mock-api-secret'),
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
