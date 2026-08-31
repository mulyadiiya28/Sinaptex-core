CREATE TABLE "opportunity_policies" (
    "id" TEXT NOT NULL,
    "freeMaxActiveNeeds" INTEGER NOT NULL DEFAULT 1,
    "freeMaxActiveOffers" INTEGER NOT NULL DEFAULT 1,
    "memberMaxActiveNeeds" INTEGER NOT NULL DEFAULT 20,
    "memberMaxActiveOffers" INTEGER NOT NULL DEFAULT 20,
    "expiredMembershipKeepCount" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_policies_pkey" PRIMARY KEY ("id")
);

INSERT INTO "opportunity_policies" (
    "id",
    "freeMaxActiveNeeds",
    "freeMaxActiveOffers",
    "memberMaxActiveNeeds",
    "memberMaxActiveOffers",
    "expiredMembershipKeepCount"
)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    1,
    1,
    20,
    20,
    1
)
ON CONFLICT ("id") DO NOTHING;
