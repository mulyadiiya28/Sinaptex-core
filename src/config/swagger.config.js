const env = require('./env');

module.exports = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Business Matching Bridge API',
      version: '1.0.0',
      description:
        'Auth → Verification → Opportunity → Boost → Matching → Ranking → Invitation → Deal',
    },
    servers: [
      { 
        url: 'https://cahayaastera.com/api/v1', 
        description: 'Production' 
      },
      { 
        url: `http://localhost:${env.port}/api/v1`, 
        description: 'Local' 
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Supabase JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan JSDoc @openapi comments di semua file routes (belum ditulis — lihat docs/api-contract.md
  // untuk ringkasan endpoint saat ini; tambahkan komentar @openapi bertahap per module)
  apis: ['./src/modules/**/*.routes.js'],
  uiPath: '/api/docs',
};

