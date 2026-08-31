/**
 * Standalone scheduler process — run separately from the API server:
 *   node src/jobs/scheduler.js   (or `npm run scheduler`)
 * Not started automatically by `npm run dev/start` so the API stays lightweight;
 * run this as its own process/container in production (see docs/deployment-guide.md).
 * node-cron runs in-process and does NOT require Redis.
 */
const cron = require('node-cron');
const schedulerConfig = require('../config/scheduler.config');
const logger = require('../core/logger');

const expireOpportunities = require('./expireOpportunities.job');
const expireInvitations = require('./expireInvitations.job');
const recomputeAllPartyStats = require('./recomputePartyStats.job');
const cleanupNotifications = require('./cleanupNotifications.job');
const fraudScan = require('./fraudScan.job');
const expireMemberships = require('./expireMemberships.job');
const databaseBackup = require('./databaseBackup.job');

function schedule(name, cronExpr, task) {
  cron.schedule(
    cronExpr,
    async () => {
      logger.info(`Running job: ${name}`);
      try {
        await task();
      } catch (err) {
        logger.error(`Job "${name}" failed`, { error: err.message });
      }
    },
    { timezone: schedulerConfig.timezone }
  );
  logger.info(`Scheduled "${name}" with cron "${cronExpr}" (${schedulerConfig.timezone})`);
}

schedule('expireOpportunities', schedulerConfig.jobs.expireOpportunities, expireOpportunities);
schedule('expireInvitations', schedulerConfig.jobs.expireInvitations, expireInvitations);
schedule('recomputePartyStats', schedulerConfig.jobs.recomputePartyStats, recomputeAllPartyStats);
schedule('cleanupNotifications', schedulerConfig.jobs.cleanupNotifications, cleanupNotifications);
schedule('fraudScan', schedulerConfig.jobs.fraudScan, fraudScan);
schedule('expireMemberships', schedulerConfig.jobs.expireMemberships, expireMemberships);
schedule('databaseBackup', schedulerConfig.jobs.weeklyDatabaseBackup, databaseBackup);

logger.info('Scheduler process started');
