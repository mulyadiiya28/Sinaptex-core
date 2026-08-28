
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

const toSafeHeaderValue = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const deprecated = (message, replacementPath) => (req, res, next) => {
  res.set("Deprecation", "true");

  if (replacementPath) {
    res.set("Link", `<${replacementPath}>; rel="successor-version"`);
  }

  const safeMessage = toSafeHeaderValue(message);
  if (safeMessage) {
    res.set("X-Deprecation-Notice", safeMessage);
  }

  next();
};
