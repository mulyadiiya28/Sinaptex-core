const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const logger = require('../../core/logger');
// Note: hasActiveMembership is resolved lazily to prevent circular dependencies
async function checkIsMember(profileId) {
  const membershipService = require('../membership/membership.service');
  return membershipService.hasActiveMembership(profileId);
}

const DEFAULTS = Object.freeze({
  freeMaxActiveNeeds: Number(process.env.OPPORTUNITY_FREE_MAX_NEEDS || 1),
  freeMaxActiveOffers: Number(process.env.OPPORTUNITY_FREE_MAX_OFFERS || 1),
  memberMaxActiveNeeds: Number(process.env.OPPORTUNITY_MEMBER_MAX_NEEDS || 20),
  memberMaxActiveOffers: Number(process.env.OPPORTUNITY_MEMBER_MAX_OFFERS || 20),
  expiredMembershipKeepCount: Number(process.env.OPPORTUNITY_EXPIRED_KEEP_COUNT || 1),
});

function validatePolicy(policy) {
  Object.entries(policy).forEach(([key, value]) => {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  });
  return policy;
}

async function getPolicy() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM "opportunity_policies"
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    if (rows && rows[0]) return rows[0];

    const d = validatePolicy(DEFAULTS);
    const rowsInserted = await prisma.$queryRaw`
      INSERT INTO "opportunity_policies" (
        "id", "freeMaxActiveNeeds", "freeMaxActiveOffers",
        "memberMaxActiveNeeds", "memberMaxActiveOffers",
        "expiredMembershipKeepCount"
      ) VALUES (
        gen_random_uuid(), ${d.freeMaxActiveNeeds}, ${d.freeMaxActiveOffers},
        ${d.memberMaxActiveNeeds}, ${d.memberMaxActiveOffers},
        ${d.expiredMembershipKeepCount}
      ) RETURNING *
    `;
    return rowsInserted[0] || DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function updatePolicy(input, updatedBy) {
  const current = await getPolicy();
  const policy = validatePolicy({
    freeMaxActiveNeeds: input.freeMaxActiveNeeds,
    freeMaxActiveOffers: input.freeMaxActiveOffers,
    memberMaxActiveNeeds: input.memberMaxActiveNeeds,
    memberMaxActiveOffers: input.memberMaxActiveOffers,
    expiredMembershipKeepCount: input.expiredMembershipKeepCount,
  });

  const rows = await prisma.$queryRaw`
    UPDATE "opportunity_policies"
    SET "freeMaxActiveNeeds" = ${policy.freeMaxActiveNeeds},
        "freeMaxActiveOffers" = ${policy.freeMaxActiveOffers},
        "memberMaxActiveNeeds" = ${policy.memberMaxActiveNeeds},
        "memberMaxActiveOffers" = ${policy.memberMaxActiveOffers},
        "expiredMembershipKeepCount" = ${policy.expiredMembershipKeepCount},
        "updatedBy" = ${updatedBy},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${current.id}
    RETURNING *
  `;
  return rows[0];
}

function getLimit(policy, { isMember, type }) {
  if (isMember) {
    return type === 'NEED' ? policy.memberMaxActiveNeeds : policy.memberMaxActiveOffers;
  }
  return type === 'NEED' ? policy.freeMaxActiveNeeds : policy.freeMaxActiveOffers;
}

/**
 * Counts all ACTIVE opportunities of the given type (NEED/OFFER) owned by any Party of the profile.
 */
async function countActiveOpportunities(profileId, type, { excludeOpportunityId } = {}) {
  return prisma.opportunity.count({
    where: {
      type,
      status: 'ACTIVE',
      party: { ownerId: profileId },
      ...(excludeOpportunityId && { id: { not: excludeOpportunityId } }),
    },
  });
}

/**
 * Checks the user's current membership status and evaluates opportunity quotas.
 * Non-members: 1 active NEED, 1 active OFFER.
 * Members: 20 active NEED, 20 active OFFER.
 */
async function checkOpportunityQuota(profileId, type, { excludeOpportunityId } = {}) {
  const isMember = await checkIsMember(profileId);
  const policy = await getPolicy();
  const maxAllowed = getLimit(policy, { isMember, type });
  const currentCount = await countActiveOpportunities(profileId, type, { excludeOpportunityId });

  return {
    isMember,
    type,
    maxAllowed,
    currentCount,
    canCreate: currentCount < maxAllowed,
    remaining: Math.max(0, maxAllowed - currentCount),
  };
}

/**
 * Service layer guard that strictly enforces the quota limit before creating or reactivating an opportunity.
 * Throws an ApiError.forbidden if the user has reached their allowed limit.
 */
async function enforceOpportunityQuota(profileId, type, { excludeOpportunityId } = {}) {
  const quota = await checkOpportunityQuota(profileId, type, { excludeOpportunityId });

  if (!quota.canCreate) {
    const userRoleText = quota.isMember ? 'membership aktif' : 'non-member (free)';
    const typeText = type === 'OFFER' ? 'Offer' : 'Need';
    const errorCode =
      type === 'OFFER' ? ErrorCodes.OFFER_QUOTA_EXCEEDED : ErrorCodes.NEED_QUOTA_EXCEEDED;

    const upgradeAdvice = quota.isMember
      ? `Silakan tutup atau nonaktifkan ${typeText} aktif lainnya sebelum membuat yang baru.`
      : `Tingkatkan akun ke Membership untuk membuat hingga 20 ${typeText} aktif.`;

    throw ApiError.forbidden(
      `Batas kuota ${typeText} aktif untuk akun ${userRoleText} adalah maksimal ${quota.maxAllowed} item. ` +
        `Saat ini Anda sudah memiliki ${quota.currentCount} ${typeText} aktif. ${upgradeAdvice}`,
      errorCode,
      {
        type,
        isMember: quota.isMember,
        currentCount: quota.currentCount,
        maxAllowed: quota.maxAllowed,
      }
    );
  }

  return quota;
}

/**
 * Trims excess active opportunities for a specific profile down to non-member limit (default 1),
 * keeping the newest N records active and closing/suspending the excess ones.
 */
async function pruneOpportunitiesForProfile(profileId, keepCount = 1) {
  const keep = Math.max(0, keepCount);

  // 1. Process OFFERs
  const activeOffers = await prisma.opportunity.findMany({
    where: {
      type: 'OFFER',
      status: 'ACTIVE',
      party: { ownerId: profileId },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  let closedOffersCount = 0;
  if (activeOffers.length > keep) {
    const toCloseOfferIds = activeOffers.slice(keep).map((o) => o.id);
    const updateResult = await prisma.opportunity.updateMany({
      where: { id: { in: toCloseOfferIds } },
      data: { status: 'CLOSED' },
    });
    closedOffersCount = updateResult.count;
  }

  // 2. Process NEEDs
  const activeNeeds = await prisma.opportunity.findMany({
    where: {
      type: 'NEED',
      status: 'ACTIVE',
      party: { ownerId: profileId },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  let closedNeedsCount = 0;
  if (activeNeeds.length > keep) {
    const toCloseNeedIds = activeNeeds.slice(keep).map((n) => n.id);
    const updateResult = await prisma.opportunity.updateMany({
      where: { id: { in: toCloseNeedIds } },
      data: { status: 'CLOSED' },
    });
    closedNeedsCount = updateResult.count;
  }

  return {
    profileId,
    keptOffers: Math.min(activeOffers.length, keep),
    closedOffersCount,
    keptNeeds: Math.min(activeNeeds.length, keep),
    closedNeedsCount,
  };
}

/**
 * Service function to scan and process all expired memberships,
 * marking them EXPIRED and resetting their active offers/needs to default non-member limit.
 */
async function processExpiredMemberships() {
  const now = new Date();

  // Find all active memberships that have passed expiresAt
  const expiredMemberships = await prisma.membership.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    select: { id: true, profileId: true },
  });

  if (expiredMemberships.length === 0) {
    return {
      expiredMembershipsCount: 0,
      totalClosedOffers: 0,
      totalClosedNeeds: 0,
      details: [],
    };
  }

  // Mark memberships as EXPIRED
  const membershipIds = expiredMemberships.map((m) => m.id);
  await prisma.membership.updateMany({
    where: { id: { in: membershipIds } },
    data: { status: 'EXPIRED' },
  });

  const policy = await getPolicy();
  const keepCount = policy.expiredMembershipKeepCount || 1;

  // Prune each affected profile's opportunities
  const pruneResults = await Promise.all(
    expiredMemberships.map((m) => pruneOpportunitiesForProfile(m.profileId, keepCount))
  );

  const totalClosedOffers = pruneResults.reduce((sum, r) => sum + r.closedOffersCount, 0);
  const totalClosedNeeds = pruneResults.reduce((sum, r) => sum + r.closedNeedsCount, 0);

  logger.info(
    `Processed ${expiredMemberships.length} expired membership(s). ` +
      `Closed ${totalClosedOffers} excess Offer(s) and ${totalClosedNeeds} excess Need(s).`
  );

  return {
    expiredMembershipsCount: expiredMemberships.length,
    totalClosedOffers,
    totalClosedNeeds,
    details: pruneResults,
  };
}

module.exports = {
  getPolicy,
  updatePolicy,
  getLimit,
  countActiveOpportunities,
  checkOpportunityQuota,
  enforceOpportunityQuota,
  assertOpportunityQuota: enforceOpportunityQuota,
  pruneOpportunitiesForProfile,
  processExpiredMemberships,
  DEFAULTS,
};
