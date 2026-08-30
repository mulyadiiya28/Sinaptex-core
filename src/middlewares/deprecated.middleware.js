/**
 * Middleware untuk menandai endpoint sebagai deprecated.
 *
 * Endpoint tetap berfungsi normal dan request tetap diteruskan.
 *
 * Headers:
 * - Deprecation: menandai endpoint deprecated
 * - Link: menunjuk ke endpoint pengganti
 *
 * Lihat docs/PROJECT_CHECKLIST.md — Phase 21.
 */

const deprecated = (message, replacementPath) => (req, res, next) => {
  // Tandai endpoint sebagai deprecated
  res.set('Deprecation', 'true');

  // Berikan endpoint pengganti jika tersedia
  if (replacementPath) {
    res.set('Link', `<${replacementPath}>; rel="successor-version"`);
  }

  // Jangan masukkan message ke HTTP header.
  // Pesan dapat mengandung karakter yang tidak valid
  // untuk HTTP header dan menyebabkan ERR_INVALID_CHAR.

  next();
};

// CommonJS default export
module.exports = deprecated;

// Kompatibilitas dengan:
// const { deprecated } = require(...)
module.exports.deprecated = deprecated;
