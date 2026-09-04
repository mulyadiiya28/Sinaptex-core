/**
 * Upload middleware — merged security hardening
 * - Client MIME first-pass filter
 * - Magic-byte validation via file-type (assertRealFileType)
 * - Optional virus-scan hook (ClamAV placeholder)
 * - Size / file count limits
 *
 * Requires: npm i file-type
 */
const multer = require('multer');
const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const logger = require('../core/logger');

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/**
 * Validate buffer magic bytes (not client Content-Type).
 * Call after multer populates req.file.buffer, before Cloudinary.
 */
async function assertRealFileType(buffer, allowedMimes = ALLOWED_MIME) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw ApiError.badRequest('Missing file content', ErrorCodes.VALIDATION_ERROR);
  }

  let fileTypeFromBuffer;
  try {
    ({ fileTypeFromBuffer } = require('file-type'));
  } catch {
    throw ApiError.internal(
      'file-type package is required for upload content validation',
      ErrorCodes.INTERNAL_ERROR
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !allowedMimes.includes(detected.mime)) {
    throw ApiError.badRequest(
      'File content does not match an allowed type',
      ErrorCodes.VALIDATION_ERROR
    );
  }
  return detected;
}

/**
 * Virus scan hook — placeholder. Wire ClamAV / cloud scanner in production.
 */
async function scanFile(buffer, filename) {
  // const { isInfected } = await clamscan.scanBuffer(buffer);
  // if (isInfected) throw ApiError.badRequest('File contains malware', 'VIRUS_DETECTED');
  logger.debug('Virus scan placeholder passed', { filename, bytes: buffer?.length });
  return { safe: true, scannedAt: new Date() };
}

/**
 * Multer single-field + magic-byte + scan pipeline.
 */
function uploadWithScan(fieldName) {
  const multerMiddleware = upload.single(fieldName);

  return (req, res, next) => {
    multerMiddleware(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('File too large (max 10MB)', ErrorCodes.VALIDATION_ERROR));
        }
        return next(ApiError.badRequest(err.message, ErrorCodes.VALIDATION_ERROR));
      }
      if (err) return next(err);

      if (req.file?.buffer) {
        try {
          await assertRealFileType(req.file.buffer);
          await scanFile(req.file.buffer, req.file.originalname);
        } catch (e) {
          return next(e);
        }
      }
      return next();
    });
  };
}

module.exports = upload;
module.exports.assertRealFileType = assertRealFileType;
module.exports.scanFile = scanFile;
module.exports.uploadWithScan = uploadWithScan;
module.exports.ALLOWED_MIME = ALLOWED_MIME;
