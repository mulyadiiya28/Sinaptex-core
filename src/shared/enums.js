// Prisma generates JS enum objects from schema.prisma at `npx prisma generate` time.
// Re-exporting here means the rest of the app never hardcodes string literals like
// 'ACTIVE' — it uses `OpportunityStatus.ACTIVE`, so a schema rename is a one-place fix.
const {
  BusinessRoleType,
  VerificationStatus,
  DocumentType,
  OpportunityType,
  OpportunityStatus,
  Visibility,
  PriorityLevel,
  BoostPackageType,
  PaymentStatus,
  InvitationStatus,
  DealStatus,
  MediaOwnerType,
} = require('@prisma/client');

module.exports = {
  BusinessRoleType,
  VerificationStatus,
  DocumentType,
  OpportunityType,
  OpportunityStatus,
  Visibility,
  PriorityLevel,
  BoostPackageType,
  PaymentStatus,
  InvitationStatus,
  DealStatus,
  MediaOwnerType,
};
