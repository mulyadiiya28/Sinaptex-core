const { Queue } = require('bullmq');
const redisConfig = require('../config/redis.config');
const queueConfig = require('../config/queue.config');
const logger = require('./logger');

function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
    };
  } catch {
    return {};
  }
}

const connection = { connection: { ...redisConfig.options, ...parseRedisUrl(redisConfig.url) } };

const queues = {};

/** Lazily creates (and caches) a BullMQ Queue instance by logical name from queue.config.js. */
function getQueue(name) {
  if (!queueConfig.queues[name]) {
    throw new Error(`Unknown queue "${name}". Add it to src/config/queue.config.js first.`);
  }
  if (!queues[name]) {
    queues[name] = new Queue(queueConfig.queues[name], connection);
  }
  return queues[name];
}

/**
 * Enqueue a job. Fails soft (logs + returns null) if Redis is unreachable —
 * queue is a performance/offload optimization, not a hard dependency for MVP.
 */
async function enqueue(queueName, jobName, payload, opts = {}) {
  try {
    const queue = getQueue(queueName);
    return await queue.add(jobName, payload, { ...queueConfig.defaultJobOptions, ...opts });
  } catch (err) {
    logger.warn(`Failed to enqueue job on "${queueName}", continuing without queue`, {
      error: err.message,
    });
    return null;
  }
}

module.exports = { getQueue, enqueue };
