/**
 * Menandai sebuah endpoint sebagai deprecated: menambahkan header standar
 * (`Deprecation`, RFC 8594 draft) + pesan kustom, TANPA memblokir request-nya
 * (endpoint tetap berfungsi penuh — lihat keputusan migrasi bertahap di
 * docs/PROJECT_CHECKLIST.md Phase 21).
 */
const deprecated = (message, replacementPath) => (req, res, next) => {
  res.set('Deprecation', 'true');
  if (replacementPath) res.set('Link', `<${replacementPath}>; rel="successor-version"`);
  res.set('X-Deprecation-Notice', message);
  next();
};

module.exports = deprecated;
