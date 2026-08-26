const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

/**
 * Uploads an in-memory file buffer (from multer.memoryStorage) to Cloudinary.
 * @param {Buffer} buffer
 * @param {{ folder: string, resourceType?: 'image'|'raw'|'auto' }} options
 * @returns {Promise<{url: string, cloudinaryId: string, format: string}>}
 */
function uploadBuffer(buffer, { folder, resourceType = 'auto' }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          cloudinaryId: result.public_id,
          format: result.format,
        });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function deleteAsset(cloudinaryId, resourceType = 'image') {
  return cloudinary.uploader.destroy(cloudinaryId, { resource_type: resourceType });
}

module.exports = { uploadBuffer, deleteAsset };
