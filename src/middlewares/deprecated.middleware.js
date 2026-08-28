
/**
 * Menandai sebuah endpoint sebagai deprecated tanpa memblokir request.
 *
 * Endpoint tetap berfungsi normal selama masa migrasi bertahap.
 *
 * Response headers:
 * - Deprecation: menandai endpoint sebagai deprecated
 * - Link: menunjuk ke endpoint pengganti
 * - X-Deprecation-Notice: pesan migrasi kustom
 *
 * Lihat docs/PROJECT_CHECKLIST.md — Phase 21.
 */
const deprecated = (message, replacementPath) => (req, res, next) => {
  res.set('Deprecation', 'true');

  if (replacementPath) {
    res.set(
      'Link',
      `<${replacementPath}>; rel="successor-version"`
    );
  }

  if (message) {
    res.set('X-Deprecation-Notice', message);
  }

  next();
};

module.exports = deprecated;
