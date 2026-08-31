const fs = require('fs');
const path = require('path');
const { dumpEssentialTables } = require('../../prisma/scripts/dump-essential');
const schedulerConfig = require('../config/scheduler.config');
const logger = require('../core/logger');

/**
 * Prunes backup files older than retention policy days.
 *
 * @param {string} storageDir
 * @param {number} retentionDays
 * @returns {string[]} List of deleted file paths
 */
function pruneOldBackups(storageDir, retentionDays) {
  if (!fs.existsSync(storageDir) || !retentionDays || retentionDays <= 0) {
    return [];
  }

  const pruned = [];
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(storageDir);
    files.forEach((file) => {
      if (file.startsWith('db_dump_essential_') && file.endsWith('.json')) {
        const fullPath = path.join(storageDir, file);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          pruned.push(fullPath);
        }
      }
    });

    if (pruned.length > 0) {
      logger.info(`[Disaster Recovery] Pruned ${pruned.length} expired backup file(s)`, {
        prunedFiles: pruned,
        retentionDays,
      });
    }
  } catch (err) {
    logger.warn(`[Disaster Recovery] Failed to prune old backups: ${err.message}`);
  }

  return pruned;
}

/**
 * Executes a weekly database backup dump targeting the disaster recovery directory.
 *
 * @param {object} [customOptions]
 * @returns {Promise<{ filePath: string, counts: Record<string, number>, sizeBytes: number, prunedCount: number }>}
 */
async function databaseBackupJob(customOptions = {}) {
  const storageDir =
    customOptions.storageDir ||
    schedulerConfig.disasterRecovery.storageDir;

  const retentionDays =
    customOptions.retentionDays !== undefined
      ? customOptions.retentionDays
      : schedulerConfig.disasterRecovery.retentionDays;

  logger.info('[Disaster Recovery] Starting scheduled database dump job...', {
    storageDir,
    retentionDays,
  });

  const dumpResult = await dumpEssentialTables({
    outDir: storageDir,
    tables: customOptions.tables,
    pretty: true,
  });

  const prunedFiles = pruneOldBackups(storageDir, retentionDays);

  logger.info('[Disaster Recovery] Scheduled database dump finished successfully', {
    filePath: dumpResult.filePath,
    counts: dumpResult.counts,
    sizeBytes: dumpResult.sizeBytes,
    prunedFilesCount: prunedFiles.length,
  });

  return {
    ...dumpResult,
    prunedCount: prunedFiles.length,
    prunedFiles,
  };
}

module.exports = databaseBackupJob;
