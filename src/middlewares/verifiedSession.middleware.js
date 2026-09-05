// src/middlewares/verifiedSession.middleware.js
let prisma;

try {
  prisma = require('../config/prisma');
} catch {
  prisma = {};
}

let supabaseAdmin;
try {
  supabaseAdmin = require('../config/supabase').supabaseAdmin;
} catch {
  supabaseAdmin = null;
}

const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');

const STATE_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function isSessionVerified(supabaseUser, profile = null) {
  if (!supabaseUser || !supabaseUser.id) {
    return {
      verified: false,
      isVerified: false,
      reason: 'No active session found',
      code: ErrorCodes.SESSION_INVALID || 'SESSION_INVALID',
    };
  }

  const status = profile?.status || profile?.accountStatus;
  if (status === 'SUSPENDED') {
    return {
      verified: false,
      isVerified: false,
      reason: `Akun Anda ditangguhkan sementara${profile.suspendedReason ? `: ${profile.suspendedReason}` : '.'
        }`,
      code: ErrorCodes.ACCOUNT_SUSPENDED || 'ACCOUNT_SUSPENDED',
    };
  }
  if (status === 'BANNED') {
    return {
      verified: false,
      isVerified: false,
      reason: 'Akun Anda diblokir permanen.',
      code: ErrorCodes.ACCOUNT_BANNED || 'ACCOUNT_BANNED',
    };
  }

  const provider = supabaseUser.app_metadata?.provider;
  const isOAuthUser = provider && provider !== 'email';

  const isVerifiedOAuthIdentity =
    Array.isArray(supabaseUser.identities) &&
    supabaseUser.identities.some(
      (identity) => identity.provider !== 'email' && identity.identity_data?.email_verified !== false
    );

  const isEmailConfirmed = Boolean(
    supabaseUser.email_confirmed_at ||
    supabaseUser.confirmed_at ||
    isOAuthUser ||
    isVerifiedOAuthIdentity
  );

  const isPhoneConfirmed = Boolean(supabaseUser.phone_confirmed_at);

  if (!isEmailConfirmed && !isPhoneConfirmed) {
    return {
      verified: false,
      isVerified: false,
      reason: 'Email or phone must be verified before executing sensitive operations.',
      code: ErrorCodes.UNVERIFIED_SESSION || 'UNVERIFIED_SESSION',
    };
  }

  return { verified: true, isVerified: true };
}

async function handleVerifiedSession(req, res, next, options = {}) {
  const {
    requireEmailVerified = true,
    protectStateChangesOnly = false,
    allowAnonymousReads = false,
  } = options;

  try {
    const isStateMutation = STATE_MUTATION_METHODS.includes(req.method?.toUpperCase());

    if (allowAnonymousReads && !isStateMutation) {
      return next();
    }

    const header = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token && !req.supabaseUser && !req.user) {
      if (protectStateChangesOnly && !isStateMutation) {
        return next();
      }
      return next(
        ApiError.unauthorized(
          'Authentication token required for this operation',
          null,
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED'
        )
      );
    }

    let supabaseUser = req.supabaseUser || req.user;

    if (!supabaseUser && token) {
      if (req.verifySupabaseToken && typeof req.verifySupabaseToken === 'function') {
        try {
          supabaseUser = await req.verifySupabaseToken(header);
        } catch {
          return next(
            ApiError.unauthorized(
              'User session is invalid, expired, or revoked',
              null,
              ErrorCodes.SESSION_INVALID || 'SESSION_INVALID'
            )
          );
        }
      } else if (supabaseAdmin?.auth?.getUser) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
          return next(
            ApiError.unauthorized(
              'User session is invalid, expired, or revoked',
              null,
              ErrorCodes.SESSION_INVALID || 'SESSION_INVALID'
            )
          );
        }
        supabaseUser = data.user;
      }
    }

    if (!supabaseUser) {
      return next(
        ApiError.unauthorized(
          'User session is invalid, expired, or revoked',
          null,
          ErrorCodes.SESSION_INVALID || 'SESSION_INVALID'
        )
      );
    }

    if (req.shouldFailOnUserNotFound) {
      return next(
        ApiError.unauthorized(
          'User account not registered locally. Please complete sign-up.',
          null,
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED'
        )
      );
    }

    let { profile, user } = req;

    if (!profile && !user && prisma && typeof prisma === 'object') {
      if (prisma.user && typeof prisma.user.findUnique === 'function') {
        try {
          user = await prisma.user.findUnique({
            where: { supabaseId: supabaseUser.id },
            include: { profile: true },
          });
          if (user?.profile) {
            profile = user.profile;
          }
        } catch (_) {
          // ignore DB error
        }
      }

      if (!profile && prisma.profile && typeof prisma.profile.findFirst === 'function') {
        try {
          profile = await prisma.profile.findFirst({
            where: { userId: supabaseUser.id },
          });
        } catch (_) {
          // ignore DB error
        }
      }
    }

    if (!user && !profile) {
      return next(
        ApiError.unauthorized(
          'User account not registered locally. Please complete sign-up.',
          null,
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED'
        )
      );
    }

    const verificationCheck = isSessionVerified(supabaseUser, profile);

    if (
      verificationCheck.code === ErrorCodes.ACCOUNT_SUSPENDED ||
      verificationCheck.code === 'ACCOUNT_SUSPENDED'
    ) {
      return next(
        ApiError.forbidden(
          verificationCheck.reason,
          null,
          ErrorCodes.ACCOUNT_SUSPENDED || 'ACCOUNT_SUSPENDED'
        )
      );
    }

    if (
      verificationCheck.code === ErrorCodes.ACCOUNT_BANNED ||
      verificationCheck.code === 'ACCOUNT_BANNED'
    ) {
      return next(
        ApiError.forbidden(
          verificationCheck.reason,
          null,
          ErrorCodes.ACCOUNT_BANNED || 'ACCOUNT_BANNED'
        )
      );
    }

    const mustVerifySession =
      requireEmailVerified || (protectStateChangesOnly && isStateMutation);

    if (mustVerifySession && !verificationCheck.isVerified) {
      return next(
        ApiError.forbidden(
          verificationCheck.reason ||
          'Verified user session is required to perform this operation.',
          null,
          verificationCheck.code || ErrorCodes.UNVERIFIED_SESSION || 'UNVERIFIED_SESSION'
        )
      );
    }

    req.supabaseUser = supabaseUser;
    req.user = user || req.user || supabaseUser;
    req.profile = profile || req.profile;
    req.sessionVerified = verificationCheck.isVerified;

    return next();
  } catch (err) {
    return next(
      ApiError.unauthorized(
        'User session is invalid, expired, or revoked',
        null,
        ErrorCodes.SESSION_INVALID || 'SESSION_INVALID'
      )
    );
  }
}

function requireVerifiedSession(options = {}, ...args) {
  if (options && options.headers && typeof options.headers === 'object' && typeof args[1] === 'function') {
    return handleVerifiedSession(options, args[0], args[1], {});
  }

  return (req, res, next) => handleVerifiedSession(req, res, next, options);
}

function protectStateChanges(options = {}, ...args) {
  if (options && options.headers && typeof options.headers === 'object' && typeof args[1] === 'function') {
    return handleVerifiedSession(options, args[0], args[1], {
      protectStateChangesOnly: true,
      requireEmailVerified: true,
    });
  }

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