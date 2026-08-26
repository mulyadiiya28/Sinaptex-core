/**
 * Generic object utilities used when shaping Prisma results into API responses.
 * Keeps controllers from leaking internal-only fields (e.g. cloudinaryId) by accident.
 */

function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) acc[key] = obj[key];
    return acc;
  }, {});
}

function omit(obj, keys) {
  if (!obj) return obj;
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

/** Strip Cloudinary internal ids before sending Media/VerificationDocument to non-owners. */
function toPublicMedia(media) {
  return omit(media, ['cloudinaryId']);
}

module.exports = { pick, omit, toPublicMedia };
