const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { created, success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * STEP 1 of the flow: Register / Login
 * The client authenticates directly against Supabase Auth (email/password, OAuth, OTP...).
 * Once it has a Supabase session, it calls this endpoint with the bearer token so we can:
 *  - mirror the Supabase user into our `users` table
 *  - create the Profile
 *  - optionally create a Party (company)
 *  - assign BusinessRole(s)
 *  - assign Capability(ies) to the Party
 * This endpoint is idempotent: calling it again just returns the existing profile.
 */
const register = asyncHandler(async (req, res) => {
  const { supabaseUser } = req; // set by a lightweight "verify token only" middleware
  const { fullName, phone, bio, location, party, businessRoles, capabilityNames } = req.body;

  const existing = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { profile: true },
  });
  if (existing?.profile) {
    return success(res, existing, 'Already registered');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { supabaseId: supabaseUser.id },
      update: { email: supabaseUser.email, phone },
      create: { supabaseId: supabaseUser.id, email: supabaseUser.email, phone },
    });

    const profile = await tx.profile.create({
      data: { userId: user.id, fullName, bio, location },
    });

    let createdParty = null;
    if (party) {
      createdParty = await tx.party.create({
        data: {
          ownerId: profile.id,
          name: party.name,
          isCompany: party.isCompany ?? true,
          categoryId: party.categoryId,
          description: party.description,
          location: party.location,
          npwp: party.npwp,
          nib: party.nib,
        },
      });

      if (capabilityNames?.length) {
        await Promise.all(
          capabilityNames.map(async (name) => {
            const capability = await tx.capability.upsert({
              where: { name },
              update: {},
              create: { name },
            });
            await tx.partyCapability.create({
              data: { partyId: createdParty.id, capabilityId: capability.id },
            });
          })
        );
      }
    }

    if (businessRoles?.length) {
      await Promise.all(
        businessRoles.map((role) =>
          tx.businessRole.create({
            data: { profileId: profile.id, role, partyId: createdParty?.id },
          })
        )
      );
    }

    return tx.profile.findUnique({
      where: { id: profile.id },
      include: { businessRoles: true, parties: true, user: true },
    });
  });

  return created(res, result, 'Registration complete');
});

/**
 * Lightweight session sync: given a valid Supabase token, return the local
 * profile (used by the frontend right after login to hydrate app state).
 */
const me = asyncHandler(async (req, res) => {
  if (!req.profile) {
    throw ApiError.notFound('Profile not found. Please complete registration.');
  }
  const profile = await prisma.profile.findUnique({
    where: { id: req.profile.id },
    include: { businessRoles: true, parties: true },
  });
  return success(res, profile);
});

module.exports = { register, me };
