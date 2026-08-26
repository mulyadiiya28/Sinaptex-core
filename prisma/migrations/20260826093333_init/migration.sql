-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessRoleType" AS ENUM ('BUYER', 'SUPPLIER', 'INVESTOR', 'STARTUP', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('KTP', 'NIB', 'NPWP', 'SERTIFIKAT', 'LAINNYA');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NEED', 'OFFER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MATCHED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'VERIFIED_ONLY');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BoostPackageType" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('NEGOTIATION', 'DEAL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('OPPORTUNITY', 'VERIFICATION', 'PROFILE', 'PARTY');

-- CreateEnum
CREATE TYPE "PartyRelationshipType" AS ENUM ('SAME_OWNER', 'SHARED_LEGAL_ID', 'SHARED_DOCUMENT', 'DECLARED_AFFILIATE', 'SUSPECTED_COLLUSION');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DataSufficiency" AS ENUM ('INSUFFICIENT', 'PARTIAL', 'SUFFICIENT');

-- CreateEnum
CREATE TYPE "DecisionInquiryStatus" AS ENUM ('OPEN', 'DIAGNOSED', 'RECOMMENDED', 'CLOSED_NO_DATA');

-- CreateEnum
CREATE TYPE "DiagnosticDataType" AS ENUM ('NUMERIC', 'PERCENTAGE', 'BOOLEAN', 'CATEGORICAL');

-- CreateEnum
CREATE TYPE "DiagnosticFactorSource" AS ENUM ('AUTO_PLATFORM', 'MANUAL_INPUT');

-- CreateEnum
CREATE TYPE "DiagnosticOperator" AS ENUM ('LT', 'LTE', 'GT', 'GTE', 'EQ', 'NEQ', 'IS_TRUE', 'IS_FALSE', 'IN');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('ADVISORY_ONLY', 'MATCH_OPPORTUNITY', 'HYBRID');

-- CreateEnum
CREATE TYPE "AdvisoryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AdvisoryAuthorType" AS ENUM ('ADMIN', 'AI_DRAFT');

-- CreateEnum
CREATE TYPE "BusinessDiagnosisStatus" AS ENUM ('DATA_COLLECTION', 'DIAGNOSED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "IntentCategory" AS ENUM ('DIRECT_SEARCH', 'NEEDS_DIAGNOSIS', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "ConversationOriginType" AS ENUM ('PROFILE', 'NEED', 'OFFER');

-- CreateEnum
CREATE TYPE "PricingStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MIDTRANS', 'XENDIT', 'DUITKU', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('QRIS', 'BANK_TRANSFER', 'VA', 'EWALLET', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "MembershipTransactionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "profileType" "ProfileType" NOT NULL DEFAULT 'INDIVIDUAL',
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_roles" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "partyId" TEXT,
    "role" "BusinessRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCompany" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "location" TEXT,
    "npwp" TEXT,
    "nib" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_capabilities" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,

    CONSTRAINT "party_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "partyId" TEXT,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "cloudinaryId" TEXT,
    "fileHash" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "rejectReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_capabilities" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,

    CONSTRAINT "opportunity_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "ownerType" "MediaOwnerType" NOT NULL,
    "opportunityId" TEXT,
    "profileId" TEXT,
    "partyId" TEXT,
    "url" TEXT NOT NULL,
    "cloudinaryId" TEXT NOT NULL,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boost_plans" (
    "id" TEXT NOT NULL,
    "type" "BoostPackageType" NOT NULL,
    "name" TEXT NOT NULL,
    "priorityWeight" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "durationDays" INTEGER NOT NULL,

    CONSTRAINT "boost_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_boosts" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "priorityWeight" DOUBLE PRECISION NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "hardFilterPassed" BOOLEAN NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromPartyId" TEXT NOT NULL,
    "toPartyId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "matchScore" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'NEGOTIATION',
    "agreedTerms" JSONB,
    "notes" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_relationships" (
    "id" TEXT NOT NULL,
    "partyAId" TEXT NOT NULL,
    "partyBId" TEXT NOT NULL,
    "type" "PartyRelationshipType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "note" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_flags" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "invitationId" TEXT,
    "partyAId" TEXT NOT NULL,
    "partyBId" TEXT NOT NULL,
    "severity" "FraudSeverity" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "status" "FraudFlagStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "root_problems" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "root_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs_to_be_done" (
    "id" TEXT NOT NULL,
    "rootProblemId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_to_be_done_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" TEXT,

    CONSTRAINT "solution_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_category_jobs" (
    "id" TEXT NOT NULL,
    "solutionCategoryId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "solution_category_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarifying_questions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarifying_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_inquiries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "statedWant" TEXT NOT NULL,
    "matchedSolutionCategoryId" TEXT,
    "diagnosedJobId" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataSufficiency" "DataSufficiency" NOT NULL DEFAULT 'INSUFFICIENT',
    "status" "DecisionInquiryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_inquiry_answers" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_inquiry_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_recommendations" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isDataGapAlert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_symptoms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" TEXT,

    CONSTRAINT "business_symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_patterns" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_factors" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" "DiagnosticDataType" NOT NULL,
    "sourceType" "DiagnosticFactorSource" NOT NULL,
    "autoSourceKey" TEXT,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_root_causes" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_root_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_decisions" (
    "id" TEXT NOT NULL,
    "rootCauseId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_rules" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "rootCauseId" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisory_contents" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorType" "AdvisoryAuthorType" NOT NULL DEFAULT 'ADMIN',
    "status" "AdvisoryStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisory_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_diagnoses" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "partyId" TEXT,
    "symptomId" TEXT NOT NULL,
    "diagnosedRootCauseId" TEXT,
    "matchedPatternId" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BusinessDiagnosisStatus" NOT NULL DEFAULT 'DATA_COLLECTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_diagnosis_factor_values" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "DiagnosticFactorSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_diagnosis_factor_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_diagnosis_recommendations" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "advisoryContentId" TEXT,
    "opportunityId" TEXT,
    "isDataGapAlert" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_diagnosis_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_logs" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "rawText" TEXT NOT NULL,
    "category" "IntentCategory" NOT NULL,
    "subtype" TEXT,
    "matchedPattern" TEXT,
    "routedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedbacks" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "recommendationId" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "originType" "ConversationOriginType" NOT NULL DEFAULT 'PROFILE',
    "opportunityId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "mediaUrl" TEXT,
    "mediaName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_pricings" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "status" "PricingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INACTIVE',
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_transactions" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "pricingId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "MembershipTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "gatewayProvider" "PaymentProvider" NOT NULL DEFAULT 'MIDTRANS',
    "paymentMethod" "PaymentMethod",
    "gatewayTransactionId" TEXT,
    "gatewayRedirectUrl" TEXT,
    "gatewayRawPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BusinessSymptomToCapability" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseId_key" ON "users"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "business_roles_profileId_role_partyId_key" ON "business_roles"("profileId", "role", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "capabilities_name_key" ON "capabilities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "party_capabilities_partyId_capabilityId_key" ON "party_capabilities"("partyId", "capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "verification_documents_fileHash_idx" ON "verification_documents"("fileHash");

-- CreateIndex
CREATE INDEX "opportunities_type_status_visibility_idx" ON "opportunities"("type", "status", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_capabilities_opportunityId_capabilityId_key" ON "opportunity_capabilities"("opportunityId", "capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "boost_plans_type_key" ON "boost_plans"("type");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_boosts_opportunityId_key" ON "opportunity_boosts"("opportunityId");

-- CreateIndex
CREATE INDEX "matches_finalScore_idx" ON "matches"("finalScore");

-- CreateIndex
CREATE UNIQUE INDEX "matches_needId_offerId_key" ON "matches"("needId", "offerId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_matchId_key" ON "invitations"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_invitationId_key" ON "deals"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_dealId_reviewerId_key" ON "reviews"("dealId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_countryId_name_key" ON "provinces"("countryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_provinceId_name_key" ON "cities"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "party_relationships_partyAId_idx" ON "party_relationships"("partyAId");

-- CreateIndex
CREATE INDEX "party_relationships_partyBId_idx" ON "party_relationships"("partyBId");

-- CreateIndex
CREATE UNIQUE INDEX "party_relationships_partyAId_partyBId_type_key" ON "party_relationships"("partyAId", "partyBId", "type");

-- CreateIndex
CREATE INDEX "fraud_flags_dealId_idx" ON "fraud_flags"("dealId");

-- CreateIndex
CREATE INDEX "fraud_flags_partyAId_idx" ON "fraud_flags"("partyAId");

-- CreateIndex
CREATE INDEX "fraud_flags_partyBId_idx" ON "fraud_flags"("partyBId");

-- CreateIndex
CREATE INDEX "fraud_flags_status_idx" ON "fraud_flags"("status");

-- CreateIndex
CREATE UNIQUE INDEX "root_problems_name_key" ON "root_problems"("name");

-- CreateIndex
CREATE UNIQUE INDEX "solution_categories_name_key" ON "solution_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "solution_category_jobs_solutionCategoryId_jobId_key" ON "solution_category_jobs"("solutionCategoryId", "jobId");

-- CreateIndex
CREATE INDEX "decision_inquiries_profileId_idx" ON "decision_inquiries"("profileId");

-- CreateIndex
CREATE INDEX "decision_inquiries_status_idx" ON "decision_inquiries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "decision_inquiry_answers_inquiryId_questionId_key" ON "decision_inquiry_answers"("inquiryId", "questionId");

-- CreateIndex
CREATE INDEX "decision_recommendations_inquiryId_idx" ON "decision_recommendations"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_symptoms_name_key" ON "business_symptoms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "business_decisions_rootCauseId_key" ON "business_decisions"("rootCauseId");

-- CreateIndex
CREATE INDEX "business_diagnoses_profileId_idx" ON "business_diagnoses"("profileId");

-- CreateIndex
CREATE INDEX "business_diagnoses_partyId_idx" ON "business_diagnoses"("partyId");

-- CreateIndex
CREATE INDEX "business_diagnoses_status_idx" ON "business_diagnoses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_diagnosis_factor_values_diagnosisId_factorId_key" ON "business_diagnosis_factor_values"("diagnosisId", "factorId");

-- CreateIndex
CREATE INDEX "business_diagnosis_recommendations_diagnosisId_idx" ON "business_diagnosis_recommendations"("diagnosisId");

-- CreateIndex
CREATE INDEX "intent_logs_category_idx" ON "intent_logs"("category");

-- CreateIndex
CREATE INDEX "intent_logs_profileId_idx" ON "intent_logs"("profileId");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_recommendationId_idx" ON "recommendation_feedbacks"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_feedbacks_recommendationType_idx" ON "recommendation_feedbacks"("recommendationType");

-- CreateIndex
CREATE INDEX "conversation_participants_participantId_idx" ON "conversation_participants"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_participantId_key" ON "conversation_participants"("conversationId", "participantId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_name_key" ON "membership_plans"("name");

-- CreateIndex
CREATE INDEX "membership_pricings_planId_status_idx" ON "membership_pricings"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_profileId_key" ON "memberships"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_transactions_invoiceNumber_key" ON "membership_transactions"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "membership_transactions_idempotencyKey_key" ON "membership_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "membership_transactions_membershipId_idx" ON "membership_transactions"("membershipId");

-- CreateIndex
CREATE INDEX "membership_transactions_status_idx" ON "membership_transactions"("status");

-- CreateIndex
CREATE INDEX "user_reports_reportedId_idx" ON "user_reports"("reportedId");

-- CreateIndex
CREATE INDEX "user_reports_status_idx" ON "user_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_slug_key" ON "static_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "_BusinessSymptomToCapability_AB_unique" ON "_BusinessSymptomToCapability"("A", "B");

-- CreateIndex
CREATE INDEX "_BusinessSymptomToCapability_B_index" ON "_BusinessSymptomToCapability"("B");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_capabilities" ADD CONSTRAINT "party_capabilities_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_capabilities" ADD CONSTRAINT "party_capabilities_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_capabilities" ADD CONSTRAINT "opportunity_capabilities_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_capabilities" ADD CONSTRAINT "opportunity_capabilities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_boosts" ADD CONSTRAINT "opportunity_boosts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_boosts" ADD CONSTRAINT "opportunity_boosts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "boost_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_needId_fkey" FOREIGN KEY ("needId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_fromPartyId_fkey" FOREIGN KEY ("fromPartyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_toPartyId_fkey" FOREIGN KEY ("toPartyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs_to_be_done" ADD CONSTRAINT "jobs_to_be_done_rootProblemId_fkey" FOREIGN KEY ("rootProblemId") REFERENCES "root_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_categories" ADD CONSTRAINT "solution_categories_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_category_jobs" ADD CONSTRAINT "solution_category_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs_to_be_done"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_category_jobs" ADD CONSTRAINT "solution_category_jobs_solutionCategoryId_fkey" FOREIGN KEY ("solutionCategoryId") REFERENCES "solution_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifying_questions" ADD CONSTRAINT "clarifying_questions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs_to_be_done"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_inquiries" ADD CONSTRAINT "decision_inquiries_diagnosedJobId_fkey" FOREIGN KEY ("diagnosedJobId") REFERENCES "jobs_to_be_done"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_inquiries" ADD CONSTRAINT "decision_inquiries_matchedSolutionCategoryId_fkey" FOREIGN KEY ("matchedSolutionCategoryId") REFERENCES "solution_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_inquiries" ADD CONSTRAINT "decision_inquiries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_inquiry_answers" ADD CONSTRAINT "decision_inquiry_answers_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "decision_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_inquiry_answers" ADD CONSTRAINT "decision_inquiry_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "clarifying_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_recommendations" ADD CONSTRAINT "decision_recommendations_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "decision_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_symptoms" ADD CONSTRAINT "business_symptoms_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_patterns" ADD CONSTRAINT "diagnostic_patterns_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "business_symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_factors" ADD CONSTRAINT "diagnostic_factors_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "business_symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_root_causes" ADD CONSTRAINT "business_root_causes_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "business_symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_decisions" ADD CONSTRAINT "business_decisions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs_to_be_done"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_decisions" ADD CONSTRAINT "business_decisions_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "business_root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_rules" ADD CONSTRAINT "diagnostic_rules_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "business_root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_rules" ADD CONSTRAINT "diagnostic_rules_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "business_symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_contents" ADD CONSTRAINT "advisory_contents_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "business_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnoses" ADD CONSTRAINT "business_diagnoses_diagnosedRootCauseId_fkey" FOREIGN KEY ("diagnosedRootCauseId") REFERENCES "business_root_causes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnoses" ADD CONSTRAINT "business_diagnoses_matchedPatternId_fkey" FOREIGN KEY ("matchedPatternId") REFERENCES "diagnostic_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnoses" ADD CONSTRAINT "business_diagnoses_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnoses" ADD CONSTRAINT "business_diagnoses_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnoses" ADD CONSTRAINT "business_diagnoses_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "business_symptoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnosis_factor_values" ADD CONSTRAINT "business_diagnosis_factor_values_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "business_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnosis_factor_values" ADD CONSTRAINT "business_diagnosis_factor_values_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "diagnostic_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnosis_recommendations" ADD CONSTRAINT "business_diagnosis_recommendations_advisoryContentId_fkey" FOREIGN KEY ("advisoryContentId") REFERENCES "advisory_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_diagnosis_recommendations" ADD CONSTRAINT "business_diagnosis_recommendations_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "business_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_logs" ADD CONSTRAINT "intent_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedbacks" ADD CONSTRAINT "recommendation_feedbacks_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_pricings" ADD CONSTRAINT "membership_pricings_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transactions" ADD CONSTRAINT "membership_transactions_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transactions" ADD CONSTRAINT "membership_transactions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_transactions" ADD CONSTRAINT "membership_transactions_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "membership_pricings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessSymptomToCapability" ADD CONSTRAINT "_BusinessSymptomToCapability_A_fkey" FOREIGN KEY ("A") REFERENCES "business_symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BusinessSymptomToCapability" ADD CONSTRAINT "_BusinessSymptomToCapability_B_fkey" FOREIGN KEY ("B") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
