/**
 * Standalone worker process — run separately: node src/queue/notification.worker.js
 * Consumes jobs enqueued for async notification delivery (email/WA/push once those
 * channels are implemented — see src/config/notification.config.js).
 */
const { Worker } = require('bullmq');
const redisConfig = require('../config/redis.config');
const queueConfig = require('../config/queue.config');
const notificationConfig = require('../config/notification.config');
const logger = require('../core/logger');

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
  queueConfig.queues.notification,
  async (job) => {
    const { channel, payload } = job.data;
    const channelConfig = notificationConfig.channels[channel];

    if (!channelConfig?.enabled) {
      logger.warn(`Channel "${channel}" is not enabled, skipping job`, { jobId: job.id });
      return { skipped: true };
    }

    // In-app notifications are already written synchronously by the controllers
    // (src/modules/notification). This branch is the placeholder for real
    // email/WA/push provider calls once those are implemented (Phase 10).
    logger.info(`Dispatching "${channel}" notification`, { jobId: job.id, payload });
    return { dispatched: true };
  },
  { connection }
);

worker.on('completed', (job) => logger.info('Job completed', { jobId: job.id, queue: 'notification' }));
worker.on('failed', (job, err) => logger.error('Job failed', { jobId: job?.id, error: err.message }));

logger.info(`notification worker listening on queue "${queueConfig.queues.notification}"`);

module.exports = worker;
