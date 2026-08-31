-- Chat rate limit policy (admin-editable; defaults seed from env at runtime)
CREATE TABLE IF NOT EXISTS "chat_rate_limit_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "maxNewConvFree" INTEGER NOT NULL DEFAULT 5,
    "maxNewConvMember" INTEGER NOT NULL DEFAULT 30,
    "unrepliedBurstMax" INTEGER NOT NULL DEFAULT 20,
    "unrepliedBurstWindowMs" INTEGER NOT NULL DEFAULT 3600000,
    "redisTtlSeconds" INTEGER NOT NULL DEFAULT 93600,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_rate_limit_policies_pkey" PRIMARY KEY ("id")
);

-- Ensure single-row policy table (app always uses first row)
CREATE UNIQUE INDEX IF NOT EXISTS "chat_rate_limit_policies_singleton_idx"
  ON "chat_rate_limit_policies" (("id" IS NOT NULL));
