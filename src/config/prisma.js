const databaseService = require('../core/database.service');

/**
 * Re-export the singleton Prisma Client instance from the Database Utility Service.
 * Ensures backward compatibility across existing modules.
 */
module.exports = databaseService.prisma;
