const prisma = require('../../config/prisma');

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
  const rows = await prisma.$queryRaw`
    SELECT * FROM "opportunity_policies"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;
  if (rows[0]) return rows[0];

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
  return rowsInserted[0];
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

module.exports = { getPolicy, updatePolicy, getLimit, DEFAULTS };
