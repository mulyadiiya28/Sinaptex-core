const env = require('./env');

module.exports = {
  provider: 'cloudinary',
  cloudName: env.cloudinary.cloudName,
  // Folder convention dipakai konsisten di semua modul yang upload file
  folders: {
    verificationProfile: 'verification/profile',
    verificationParty: 'verification/party',
    opportunityMedia: 'opportunity-media',
  },
  limits: {
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB, selaras dengan upload.middleware.js
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
};
