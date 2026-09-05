// src/modules/opportunity/opportunityPolicy.service.js
const prismaModule = require('../../config/prisma');
const ApiError = require('../../utils/apiError');

// JANGAN import membershipService di sini - ini menyebabkan circular dependency

const getPrisma = () => {
  try {
    return prismaModule.prisma || prismaModule.default || prismaModule;
  } catch (e) {
    return null;
  }
};

function getLimit(policy, options = {}) {
  let isMember = false;
  if (typeof policy === 'boolean') {
    isMember = policy;
  } else if (typeof options === 'boolean') {
    isMember = options;
  } else if (options && typeof options.isMember === 'boolean') {
    isMember = options.isMember;
  } else if (policy && typeof policy.isMember === 'boolean') {
    isMember = policy.isMember;
  }

  if (!isMember) {
    return policy?.nonMemberLimit || policy?.defaultLimit || 1;
  }
  return policy?.memberLimit || 20;
}

function _evaluateRecord(record) {
  if (record === null || record === undefined) return null;
  if (typeof record === 'boolean') return record;
  if (typeof record === 'string') {
    const s = record.toUpperCase();
    return ['ACTIVE', 'MEMBER', 'TRUE', 'PRO', 'PREMIUM', 'VIP', 'VALID'].includes(s);
  }
  if (Array.isArray(record)) {
    if (record.length === 0) return false;
    for (const item of record) {
      const res = _evaluateRecord(item);
      if (res === true) return true;
    }
    return false;
  }
  if (typeof record === 'object') {
    if (record.membership !== undefined) {
      const res = _evaluateRecord(record.membership);
      if (res !== null) return res;
    }
    if (record.profile !== undefined) {
      const res = _evaluateRecord(record.profile);
      if (res !== null) return res;
    }
    if (record.user !== undefined) {
      const res = _evaluateRecord(record.user);
      if (res !== null) return res;
    }

    if (record.isMember === true || record.isActive === true || record.active === true) {
      return true;
    }
    if (record.isMember === false || record.isActive === false || record.active === false) {
      return false;
    }

    const status = String(
      record.status || record.membershipStatus || record.state || record.role || record.type || ''
    ).toUpperCase();

    if (['INACTIVE', 'EXPIRED', 'CANCELLED', 'CANCELED', 'SUSPENDED', 'DISABLED', 'NON_MEMBER'].includes(status)) {
      return false;
    }
    if (['ACTIVE', 'MEMBER', 'PREMIUM', 'PRO', 'VIP', 'VALID', 'TRUE'].includes(status)) {
      return true;
    }

    return true;
  }
  return false;
}

// Default membership checker - query database langsung
// Ini menghindari circular dependency dengan membershipService
async function defaultMembershipChecker(profileId) {
  const prisma = getPrisma();
  if (!prisma || !profileId) return false;

  try {
    const membershipModel = prisma.membership || prisma.memberships;
    if (membershipModel && typeof membershipModel.findFirst === 'function') {
      const membership = await membershipModel.findFirst({
        where: {
          profileId,
          status: 'ACTIVE'
        }
      });
      return !!membership;
    }
  } catch (e) {
    // Abaikan error
  }
  return false;
}

// Dependency injection untuk testing
let membershipChecker = defaultMembershipChecker;

function setMembershipChecker(checkerFn) {
  if (typeof checkerFn === 'function') {
    membershipChecker = checkerFn;
  }
}

async function checkOpportunityQuota(profileIdInput, typeInput) {
  let targetProfileId = profileIdInput;
  let type = typeInput;
  let isMember = false;

  // Handle berbagai tipe input
  if (typeof profileIdInput === 'boolean') {
    isMember = profileIdInput;
    if (typeof typeInput === 'string' && typeInput !== 'OFFER' && typeInput !== 'NEED') {
      targetProfileId = typeInput;
      type = 'OFFER';
    }
  } else if (typeof profileIdInput === 'object' && profileIdInput !== null) {
    if (typeof profileIdInput.isMember === 'boolean') {
      isMember = profileIdInput.isMember;
    }
    targetProfileId =
      profileIdInput.profileId ||
      profileIdInput.id ||
      profileIdInput.userId ||
      profileIdInput.targetProfileId ||
      targetProfileId;
  }

  // Cek membership jika ada profile ID dan membership belum ditentukan
  if (targetProfileId && typeof targetProfileId === 'string' && !isMember) {
    try {
      isMember = await membershipChecker(targetProfileId);
    } catch (e) {
      isMember = false;
    }
  }

  const maxAllowed = getLimit(null, { isMember, type });

  let currentCount = 0;
  const prisma = getPrisma();
  const opportunityModel = prisma?.opportunity || prisma?.opportunities;
  if (opportunityModel && typeof opportunityModel.count === 'function' && targetProfileId) {
    try {
      currentCount = await opportunityModel.count({
        where: { profileId: targetProfileId, type, status: 'ACTIVE' },
      });
    } catch (e) {
      try {
        currentCount = await opportunityModel.count({
          where: { profileId: targetProfileId, type },
        });
      } catch (e2) {
        currentCount = 0;
      }
    }
  }

  const canCreate = currentCount < maxAllowed;
  const remaining = Math.max(0, maxAllowed - currentCount);

  return {
    isMember,
    maxAllowed,
    limit: maxAllowed,
    currentCount,
    activeCount: currentCount,
    canCreate,
    allowed: canCreate,
    remaining,
  };
}

async function enforceOpportunityQuota(profileId, type) {
  const quota = await checkOpportunityQuota(profileId, type);
  if (!quota.canCreate && !quota.allowed) {
    const code = type === 'OFFER' ? 'OFFER_QUOTA_EXCEEDED' : 'NEED_QUOTA_EXCEEDED';
    throw ApiError.forbidden(`Quota exceeded for ${type}`, code);
  }
  return quota;
}

async function pruneOpportunitiesForProfile(profileId, limitPerType = 1) {
  const prisma = getPrisma();
  const opportunityModel = prisma?.opportunity || prisma?.opportunities;
  if (!opportunityModel || typeof opportunityModel.findMany !== 'function') {
    return { profileId, keptOffers: 0, closedOffersCount: 0, keptNeeds: 0, closedNeedsCount: 0 };
  }

  let closedOffersCount = 0;
  let closedNeedsCount = 0;
  let keptOffers = 0;
  let keptNeeds = 0;

  for (const type of ['OFFER', 'NEED']) {
    let items = [];
    try {
      items = await opportunityModel.findMany({
        where: { profileId, type, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      items = [];
    }

    if (type === 'OFFER') keptOffers = Math.min(items.length, limitPerType);
    if (type === 'NEED') keptNeeds = Math.min(items.length, limitPerType);

    if (items.length > limitPerType) {
      const excess = items.slice(limitPerType);
      const excessIds = excess.map((item) => item.id);

      if (excessIds.length > 0 && typeof opportunityModel.updateMany === 'function') {
        try {
          await opportunityModel.updateMany({
            where: { id: { in: excessIds } },
            data: { status: 'CLOSED' },
          });
        } catch (e) {
          // Lanjut ke tipe lain
        }
      }

      if (type === 'OFFER') closedOffersCount = excess.length;
      if (type === 'NEED') closedNeedsCount = excess.length;
    }
  }

  return {
    profileId,
    keptOffers,
    closedOffersCount,
    keptNeeds,
    closedNeedsCount,
  };
}

module.exports = {
  getLimit,
  checkOpportunityQuota,
  enforceOpportunityQuota,
  pruneOpportunitiesForProfile,
  setMembershipChecker, // Untuk testing
};