/**
 * Standalone worker process — run separately from the API server:
 *   node src/queue/partyStats.worker.js
 * Requires REDIS_URL to be reachable. Not started automatically by `npm run dev/start`
 * (see docs/PROJECT_CHECKLIST.md Phase 11) so the API keeps working even without Redis.
 */
const { Worker } = require('bullmq');
const redisConfig = require('../config/redis.config');
const queueConfig = require('../config/queue.config');
const logger = require('../core/logger');
const { recomputePartyStats } = require('../modules/ranking/partyStats.service');

function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined };
  } catch {
    return {};
  }
}

const connection = { ...redisConfig.options, ...parseRedisUrl(redisConfig.url) };

const worker = new Worker(
  queueConfig.queues.partyStats,
  async (job) => {
    const { partyId } = job.data;
    logger.info('Recomputing party stats', { partyId, jobId: job.id });
    return recomputePartyStats(partyId);
  },
  { connection }
);

worker.on('completed', (job) => logger.info('Job completed', { jobId: job.id, queue: 'partyStats' }));
worker.on('failed', (job, err) => logger.error('Job failed', { jobId: job?.id, error: err.message }));

logger.info(`partyStats worker listening on queue "${queueConfig.queues.partyStats}"`);

module.exports = worker;
