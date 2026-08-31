const prisma = require('../../config/prisma');
const logger = require('../../core/logger');

/**
 * Chat rate-limit policy — prioritas:
 * 1) Baris di DB `chat_rate_limit_policies` (diubah admin)
 * 2) Default dari env (CHAT_*)
 *
 * Pola sama dengan opportunity_policies.
 */

const DEFAULTS = Object.freeze({
  maxNewConvFree: Number(process.env.CHAT_NEW_CONV_MAX_FREE || 5),
  maxNewConvMember: Number(process.env.CHAT_NEW_CONV_MAX_MEMBER || 30),
  unrepliedBurstMax: Number(process.env.CHAT_UNREPLIED_BURST_MAX || 20),
  unrepliedBurstWindowMs: Number(process.env.CHAT_UNREPLIED_BURST_WINDOW_MS || 60 * 60 * 1000),
  redisTtlSeconds: Number(process.env.CHAT_RATE_LIMIT_REDIS_TTL_SECONDS || 26 * 60 * 60),
});

function validatePolicy(input) {
  const policy = {
    maxNewConvFree: Number(input.maxNewConvFree),
    maxNewConvMember: Number(input.maxNewConvMember),
    unrepliedBurstMax: Number(input.unrepliedBurstMax),
    unrepliedBurstWindowMs: Number(input.unrepliedBurstWindowMs),
    redisTtlSeconds: Number(input.redisTtlSeconds),
  };

  Object.entries(policy).forEach(([key, value]) => {
    if (!Number.isFinite(value) || value < 1) {
      throw new Error(`${key} must be a positive number`);
    }
  });

  if (policy.maxNewConvFree > policy.maxNewConvMember) {
    throw new Error('maxNewConvFree cannot exceed maxNewConvMember');
  }
  if (policy.unrepliedBurstWindowMs < 60_000) {
    throw new Error('unrepliedBurstWindowMs minimum 60000 (1 menit)');
  }
  if (policy.redisTtlSeconds < 3600) {
    throw new Error('redisTtlSeconds minimum 3600');
  }

  return {
    maxNewConvFree: Math.floor(policy.maxNewConvFree),
    maxNewConvMember: Math.floor(policy.maxNewConvMember),
    unrepliedBurstMax: Math.floor(policy.unrepliedBurstMax),
    unrepliedBurstWindowMs: Math.floor(policy.unrepliedBurstWindowMs),
    redisTtlSeconds: Math.floor(policy.redisTtlSeconds),
  };
}

// Cache singkat in-process agar tidak query DB tiap pesan chat
let cache = { value: null, expiresAt: 0 };
const CACHE_TTL_MS = 30_000;

function invalidateCache() {
  cache = { value: null, expiresAt: 0 };
}

async function getPolicy() {
  if (cache.value && Date.now() < cache.expiresAt) {
    return cache.value;
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM "chat_rate_limit_policies"
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;

    if (rows && rows[0]) {
      const row = rows[0];
      const policy = {
        id: row.id,
        maxNewConvFree: row.maxNewConvFree,
        maxNewConvMember: row.maxNewConvMember,
        unrepliedBurstMax: row.unrepliedBurstMax,
        unrepliedBurstWindowMs: row.unrepliedBurstWindowMs,
        redisTtlSeconds: row.redisTtlSeconds,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
        source: 'database',
      };
      cache = { value: policy, expiresAt: Date.now() + CACHE_TTL_MS };
      return policy;
    }

    const d = validatePolicy(DEFAULTS);
    const inserted = await prisma.$queryRaw`
      INSERT INTO "chat_rate_limit_policies" (
        "id", "maxNewConvFree", "maxNewConvMember",
        "unrepliedBurstMax", "unrepliedBurstWindowMs", "redisTtlSeconds"
      ) VALUES (
        gen_random_uuid(), ${d.maxNewConvFree}, ${d.maxNewConvMember},
        ${d.unrepliedBurstMax}, ${d.unrepliedBurstWindowMs}, ${d.redisTtlSeconds}
      ) RETURNING *
    `;

    const row = inserted[0];
    const policy = {
      id: row?.id,
      ...d,
      updatedBy: null,
      updatedAt: row?.updatedAt || new Date(),
      source: 'database',
    };
    cache = { value: policy, expiresAt: Date.now() + CACHE_TTL_MS };
    return policy;
  } catch (err) {
    logger.warn('chat rate-limit policy: DB unavailable, using env defaults', {
      error: err.message,
    });
    const policy = { ...validatePolicy(DEFAULTS), source: 'env', id: null };
    cache = { value: policy, expiresAt: Date.now() + CACHE_TTL_MS };
    return policy;
  }
}

async function updatePolicy(input, updatedBy) {
  const current = await getPolicy();
  const next = validatePolicy({
    maxNewConvFree: input.maxNewConvFree ?? current.maxNewConvFree,
    maxNewConvMember: input.maxNewConvMember ?? current.maxNewConvMember,
    unrepliedBurstMax: input.unrepliedBurstMax ?? current.unrepliedBurstMax,
    unrepliedBurstWindowMs: input.unrepliedBurstWindowMs ?? current.unrepliedBurstWindowMs,
    redisTtlSeconds: input.redisTtlSeconds ?? current.redisTtlSeconds,
  });

  if (!current.id) {
    // Tabel mungkin belum ada / gagal seed — coba insert
    const inserted = await prisma.$queryRaw`
      INSERT INTO "chat_rate_limit_policies" (
        "id", "maxNewConvFree", "maxNewConvMember",
        "unrepliedBurstMax", "unrepliedBurstWindowMs", "redisTtlSeconds",
        "updatedBy"
      ) VALUES (
        gen_random_uuid(), ${next.maxNewConvFree}, ${next.maxNewConvMember},
        ${next.unrepliedBurstMax}, ${next.unrepliedBurstWindowMs}, ${next.redisTtlSeconds},
        ${updatedBy || null}
      ) RETURNING *
    `;
    invalidateCache();
    return { ...inserted[0], source: 'database' };
  }

  const rows = await prisma.$queryRaw`
    UPDATE "chat_rate_limit_policies"
    SET "maxNewConvFree" = ${next.maxNewConvFree},
        "maxNewConvMember" = ${next.maxNewConvMember},
        "unrepliedBurstMax" = ${next.unrepliedBurstMax},
        "unrepliedBurstWindowMs" = ${next.unrepliedBurstWindowMs},
        "redisTtlSeconds" = ${next.redisTtlSeconds},
        "updatedBy" = ${updatedBy || null},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${current.id}::uuid
    RETURNING *
  `;

  invalidateCache();
  return { ...rows[0], source: 'database' };
}

module.exports = {
  DEFAULTS,
  getPolicy,
  updatePolicy,
  invalidateCache,
  validatePolicy,
};
