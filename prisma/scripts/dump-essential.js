const fs = require('fs');
const path = require('path');
const prisma = require('../../src/config/prisma');
const logger = require('../../src/core/logger');

/**
 * Tables that constitute essential business data for backup and recovery.
 */
const DEFAULT_TABLES = ['users', 'profiles', 'parties', 'offers', 'needs', 'memberships'];

/**
 * Generates an ISO-like filename timestamp (YYYYMMDD_HHMMSS).
 *
 * @param {Date} date
 * @returns {string}
 */
function getTimestampString(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
}

/**
 * Dumps essential data (Users, Profiles, Parties, Offers, Needs, Memberships)
 * to a structured JSON file or directory.
 *
 * @param {object} options
 * @param {string} [options.outDir] - Directory where dump file will be written
 * @param {string[]} [options.tables] - Specific tables to dump
 * @param {boolean} [options.pretty=true] - Format JSON with indentation
 * @returns {Promise<{ filePath: string, counts: Record<string, number>, timestamp: string, sizeBytes: number }>}
 */
async function dumpEssentialTables(options = {}) {
  const outDir = options.outDir || process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  const pretty = options.pretty !== false;
  const requestedTables = options.tables && options.tables.length > 0 ? options.tables : DEFAULT_TABLES;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const timestamp = getTimestampString();
  const fileName = `db_dump_essential_${timestamp}.json`;
  const filePath = path.join(outDir, fileName);

  const dumpData = {
    metadata: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      generator: 'sinaptex-essential-db-dump',
      environment: process.env.NODE_ENV || 'development',
      tables: requestedTables,
    },
    data: {},
    summary: {},
  };

  try {
    // 1. Users & Associated Profiles
    if (requestedTables.includes('users')) {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          supabaseId: true,
          email: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      dumpData.data.users = users;
      dumpData.summary.users = users.length;
    }

    if (requestedTables.includes('profiles')) {
      const profiles = await prisma.profile.findMany({
        select: {
          id: true,
          userId: true,
          fullName: true,
          avatarUrl: true,
          bio: true,
          location: true,
          phone: true,
          accountStatus: true,
          verificationStatus: true,
          reputationScore: true,
          trustScore: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      dumpData.data.profiles = profiles;
      dumpData.summary.profiles = profiles.length;
    }

    // 2. Parties (Organizations / Businesses)
    if (requestedTables.includes('parties')) {
      const parties = await prisma.party.findMany({
        select: {
          id: true,
          ownerId: true,
          name: true,
          isCompany: true,
          categoryId: true,
          description: true,
          location: true,
          npwp: true,
          nib: true,
          verificationStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      dumpData.data.parties = parties;
      dumpData.summary.parties = parties.length;
    }

    // 3. Opportunities: Offers & Needs
    if (requestedTables.includes('offers') || requestedTables.includes('needs')) {
      const needRequested = requestedTables.includes('needs');
      const offerRequested = requestedTables.includes('offers');

      let whereType;

      if (needRequested && offerRequested) {
        whereType = undefined;
      } else if (needRequested) {
        whereType = "NEED";
      } else {
        whereType = "OFFER";
      }

      const opportunities = await prisma.opportunity.findMany({
        where: whereType ? { type: whereType } : undefined,
        select: {
          id: true,
          partyId: true,
          type: true,
          title: true,
          description: true,
          budgetMin: true,
          budgetMax: true,
          priority: true,
          visibility: true,
          status: true,
          tags: true,
          location: true,
          categoryId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (offerRequested) {
        const offers = opportunities.filter((o) => o.type === 'OFFER');
        dumpData.data.offers = offers;
        dumpData.summary.offers = offers.length;
      }

      if (needRequested) {
        const needs = opportunities.filter((o) => o.type === 'NEED');
        dumpData.data.needs = needs;
        dumpData.summary.needs = needs.length;
      }
    }

    // 4. Memberships
    if (requestedTables.includes('memberships')) {
      const memberships = await prisma.membership.findMany({
        select: {
          id: true,
          profileId: true,
          status: true,
          activatedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      dumpData.data.memberships = memberships;
      dumpData.summary.memberships = memberships.length;
    }

    const fileContent = pretty
      ? JSON.stringify(dumpData, null, 2)
      : JSON.stringify(dumpData);

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    const stats = fs.statSync(filePath);

    logger.info(`[Backup] Essential database dump completed successfully: ${filePath}`, {
      filePath,
      summary: dumpData.summary,
      sizeBytes: stats.size,
    });

    return {
      filePath,
      fileName,
      counts: dumpData.summary,
      timestamp,
      sizeBytes: stats.size,
    };
  } catch (error) {
    logger.error(`[Backup Error] Failed to dump essential database tables: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
}

// CLI Execution Support
if (require.main === module) {
  const args = process.argv.slice(2);
  const outDirArg = args.find((a) => a.startsWith('--out='))?.split('=')[1];

  dumpEssentialTables({ outDir: outDirArg })
    .then((result) => {
      console.log('✅ Database dump completed successfully:');
      console.log(`   File: ${result.filePath}`);
      console.log(`   Size: ${(result.sizeBytes / 1024).toFixed(2)} KB`);
      console.log('   Records:', JSON.stringify(result.counts, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Database dump failed:', err.message);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  dumpEssentialTables,
  DEFAULT_TABLES,
  getTimestampString,
};
