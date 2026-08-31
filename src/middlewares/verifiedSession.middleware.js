const { supabaseAdmin } = require('../config/supabase');
const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * State-modifying HTTP methods that cause transactional or financial state changes.
 */
const STATE_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Validates whether a Supabase user session satisfies verification requirements.
 *
 * @param {object} supabaseUser - The user object from Supabase Auth
 * @param {object} [profile] - The local profile record from DB
 * @returns {{ isVerified: boolean, reason?: string, code?: string }}
 */
function isSessionVerified(supabaseUser, profile = null) {
  if (!supabaseUser || !supabaseUser.id) {
    return { isVerified: false, reason: 'No active session found' };
  }

  // Check if email or phone is confirmed in Supabase auth
  const isEmailConfirmed = Boolean(
    supabaseUser.email_confirmed_at ||
    supabaseUser.confirmed_at ||
    supabaseUser.app_metadata?.provider === 'google' ||
    supabaseUser.app_metadata?.provider === 'github' ||
    (supabaseUser.identities && supabaseUser.identities.length > 0)
  );

  const isPhoneConfirmed = Boolean(supabaseUser.phone_confirmed_at);

  if (!isEmailConfirmed && !isPhoneConfirmed) {
    return {
      isVerified: false,
      reason: 'Email or phone must be verified before executing sensitive state changes',
    };
  }

  // Check profile account status if available
  if (profile) {
    if (profile.accountStatus === 'SUSPENDED') {
      return {
        isVerified: false,
        reason: 'Account is temporarily suspended',
        code: ErrorCodes.ACCOUNT_SUSPENDED,
      };
    }
    if (profile.accountStatus === 'BANNED') {
      return {
        isVerified: false,
        reason: 'Account is permanently banned',
        code: ErrorCodes.ACCOUNT_BANNED,
      };
    }
  }

  return { isVerified: true };
}

/**
 * Reusable middleware that enforces an authenticated and verified user session.
 * Specifically guards sensitive routes such as Escrow and Membership state transitions.
 *
 * @param {object} [options]
 * @param {boolean} [options.requireEmailVerified=true] - Enforce verified email/phone on session
 * @param {boolean} [options.protectStateChangesOnly=false] - Only strictly verify on POST/PUT/PATCH/DELETE
 * @param {boolean} [options.allowAnonymousReads=false] - Allow unauthenticated GET/HEAD reads
 */
function requireVerifiedSession(options = {}) {
  const {
    requireEmailVerified = true,
    protectStateChangesOnly = false,
    allowAnonymousReads = false,
  } = options;

  return asyncHandler(async (req, res, next) => {
    const isStateMutation = STATE_MUTATION_METHODS.includes(req.method.toUpperCase());

    // If safe read methods are permitted anonymously and this is not a mutation
    if (allowAnonymousReads && !isStateMutation) {
      return next();
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (protectStateChangesOnly && !isStateMutation) {
        return next();
      }
      throw ApiError.unauthorized('Authentication token required for this operation', ErrorCodes.UNAUTHORIZED);
    }

    // Verify session token with Supabase Auth
    const authResult = (await supabaseAdmin.auth.getUser(token)) || {};
    const { data, error } = authResult;
    if (error || !data?.user) {
      throw ApiError.unauthorized('User session is invalid, expired, or revoked', ErrorCodes.SESSION_INVALID);
    }

    const supabaseUser = data.user;

    // Load local user & profile
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { profile: true },
    });

    if (!user) {
      throw ApiError.unauthorized(
        'User account not registered locally. Please complete sign-up.',
        ErrorCodes.UNAUTHORIZED
      );
    }

    const { profile } = user;

    // Verify session verification requirements
    const verificationCheck = isSessionVerified(supabaseUser, profile);

    if (requireEmailVerified || isStateMutation) {
      if (!verificationCheck.isVerified) {
        if (verificationCheck.code === ErrorCodes.ACCOUNT_SUSPENDED) {
          throw ApiError.forbidden(
            `Akun Anda ditangguhkan sementara${profile.suspendedReason ? `: ${profile.suspendedReason}` : '.'}`,
            ErrorCodes.ACCOUNT_SUSPENDED
          );
        }
        if (verificationCheck.code === ErrorCodes.ACCOUNT_BANNED) {
          throw ApiError.forbidden('Akun Anda diblokir permanen.', ErrorCodes.ACCOUNT_BANNED);
        }

        throw ApiError.forbidden(
          verificationCheck.reason || 'Verified user session is required to perform state changes.',
          ErrorCodes.UNVERIFIED_SESSION
        );
      }
    }

    // Attach validated context to request
    req.supabaseUser = supabaseUser;
    req.user = user;
    req.profile = profile;
    req.sessionVerified = true;

    next();
  });
}

/**
 * Shortcut middleware to protect routes against unverified state-altering operations (POST, PUT, PATCH, DELETE),
 * while permitting authenticated reads.
 */
function protectStateChanges(options = {}) {
  return requireVerifiedSession({
    protectStateChangesOnly: true,
    requireEmailVerified: true,
    ...options,
  });
}

module.exports = {
  STATE_MUTATION_METHODS,
  isSessionVerified,
  requireVerifiedSession,
  protectStateChanges,
};
