/**
 * Opportunity Policy Service — Security Fix
 * Replaced raw $queryRaw with safe Prisma queries
 */
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const logger = require('../../core/logger');

// Lazy import to prevent circular dependency
async function checkIsMember(profileId) {
  const membershipService = require('../membership/membership.service');
  return membershipService.hasActiveMembership(profileId);
}

const DEFAULTS = Object.freeze({
  freeMaxOpportunities: Number(process.env.OPPORTUNITY_FREE_MAX || 1),
  memberMaxOpportunities: Number(process.env.OPPORTUNITY_MEMBER_MAX || 10),
});

/**
 * Count active opportunities using safe Prisma query
 * (REPLACED: $queryRaw with template literal)
 */
async function countActiveOpportunities(profileId) {
  return prisma.opportunity.count({
    where: {
      isActive: true,
      party: { ownerId: profileId },
    },
  });
}

async function enforceOpportunityQuota(profileId) {
  const isMember = await checkIsMember(profileId);
  const maxAllowed = isMember ? DEFAULTS.memberMaxOpportunities : DEFAULTS.freeMaxOpportunities;

  const currentCount = await countActiveOpportunities(profileId);

  if (currentCount >= maxAllowed) {
    const userRoleText = isMember ? 'membership aktif' : 'non-member (free)';
    const upgradeAdvice = isMember
      ? 'Silakan nonaktifkan opportunity lain sebelum membuat yang baru.'
      : 'Tingkatkan ke Membership untuk membuat hingga 10 opportunity aktif.';

    throw ApiError.forbidden(
      `Batas opportunity aktif untuk akun ${userRoleText} adalah maksimal ${maxAllowed} item. ` +
        `Saat ini Anda sudah memiliki ${currentCount} opportunity aktif. ${upgradeAdvice}`,
      ErrorCodes.OPPORTUNITY_QUOTA_EXCEEDED,
      { isMember, currentCount, maxAllowed }
    );
  }

  return { isMember, currentCount, maxAllowed, remaining: maxAllowed - currentCount };
}

async function enforceOpportunityOwner(opportunityId, profileId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { party: true },
  });

  if (!opportunity) {
    throw ApiError.notFound('Opportunity tidak ditemukan', ErrorCodes.OPPORTUNITY_NOT_FOUND);
  }

  if (opportunity.party.ownerId !== profileId) {
    throw ApiError.forbidden('Anda bukan pemilik opportunity ini', ErrorCodes.FORBIDDEN);
  }

  return opportunity;
}

module.exports = {
  enforceOpportunityQuota,
  enforceOpportunityOwner,
  countActiveOpportunities,
  DEFAULTS,
};
