/**
 * One-shot job runner for shared hosting (Hostinger cron).
 *
 * Process starts → runs selected job(s) → exits.
 * Does NOT keep node-cron alive (unlike scheduler.js).
 *
 * Usage:
 *   node src/jobs/run-once.js expireMemberships
 *   node src/jobs/run-once.js expireOpportunities expireInvitations
 *   node src/jobs/run-once.js --group=frequent
 *   node src/jobs/run-once.js --group=daily
 *   npm run jobs:daily
 *
 * Env: load from .env in project root (via src/config/env.js → dotenv).
 * Cron must `cd` into the app directory so DATABASE_URL is found.
 */

require('../config/env');
const logger = require('../core/logger');
const prisma = require('../config/prisma');

const JOBS = {
  expireOpportunities: require('./expireOpportunities.job'),
  expireInvitations: require('./expireInvitations.job'),
  expireMemberships: require('./expireMemberships.job'),
  recomputePartyStats: require('./recomputePartyStats.job'),
  cleanupNotifications: require('./cleanupNotifications.job'),
  fraudScan: require('./fraudScan.job'),
  databaseBackup: require('./databaseBackup.job'),
};

const GROUPS = {
  frequent: ['expireOpportunities', 'expireInvitations'],
  daily: ['expireMemberships', 'recomputePartyStats', 'cleanupNotifications', 'fraudScan'],
  weekly: ['databaseBackup'],
  all: Object.keys(JOBS),
};

function resolveJobNames(argv) {
  const groupArg = argv.find((a) => a.startsWith('--group='));
  if (groupArg) {
    const name = groupArg.split('=')[1];
    const list = GROUPS[name];
    if (!list) {
      throw new Error(`Unknown group "${name}". Use: ${Object.keys(GROUPS).join(', ')}`);
    }
    return list;
  }

  const names = argv.filter((a) => !a.startsWith('--'));
  if (names.length === 0) {
    throw new Error(
      'Usage: node src/jobs/run-once.js <jobName...> | --group=frequent|daily|all\n' +
        `Jobs: ${Object.keys(JOBS).join(', ')}`
    );
  }
  return names;
}

async function runJob(name) {
  const fn = JOBS[name];
  if (!fn) {
    throw new Error(`Unknown job "${name}". Jobs: ${Object.keys(JOBS).join(', ')}`);
  }
  logger.info(`run-once: starting job "${name}"`);
  const started = Date.now();
  try {
    const result = await fn();
    logger.info(`run-once: finished job "${name}"`, {
      result,
      ms: Date.now() - started,
    });
  } catch (err) {
    logger.error(`run-once: job "${name}" failed`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function main() {
  const jobNames = resolveJobNames(process.argv.slice(2));
  // Sequential (bukan for...of) — airbnb no-restricted-syntax
  await jobNames.reduce(
    (chain, name) => chain.then(() => runJob(name)),
    Promise.resolve()
  );
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
