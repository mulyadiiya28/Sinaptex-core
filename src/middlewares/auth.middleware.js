const { supabaseAdmin } = require('../config/supabase');
const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const ErrorCodes = require('../utils/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the Supabase access token from `Authorization: Bearer <token>`,
 * ensures a matching local User + Profile exists, and attaches them to req.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized('Missing bearer token');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const supabaseUser = data.user;

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { profile: true },
  });

  if (!user) {
    throw ApiError.unauthorized('Account not registered locally. Complete registration first.');
  }

  // MVP Phase 12: akun yang di-suspend/ban admin ditolak di gerbang paling depan,
  // bukan dicek berulang di tiap controller.
  if (user.profile?.accountStatus === 'SUSPENDED') {
    throw ApiError.forbidden(
      `Akun Anda ditangguhkan sementara${user.profile.suspendedReason ? `: ${user.profile.suspendedReason}` : '.'}`,
      ErrorCodes.ACCOUNT_SUSPENDED
    );
  }
  if (user.profile?.accountStatus === 'BANNED') {
    throw ApiError.forbidden('Akun Anda diblokir permanen.', ErrorCodes.ACCOUNT_BANNED);
  }

  req.supabaseUser = supabaseUser;
  req.user = user;
  req.profile = user.profile;
  next();
});

/**
 * Verifies the Supabase token only, without requiring a local User/Profile to
 * already exist. Used by the register endpoint (first-time sign-up sync).
 */
const verifySupabaseToken = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Missing bearer token');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw ApiError.unauthorized('Invalid or expired token');

  req.supabaseUser = data.user;
  next();
});

/**
 * Like requireAuth, but never throws — attaches req.profile if a valid bearer
 * token is present, otherwise leaves it undefined and continues. Used for
 * public-facing endpoints (e.g. Decision Engine) that should work for
 * anonymous visitors but still personalize when a user is logged in.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return next();

    const user = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      include: { profile: true },
    });
    if (user) {
      req.supabaseUser = data.user;
      req.user = user;
      req.profile = user.profile;
    }
  } catch {
    // Fail open: an invalid/expired token on an optional-auth route just means "anonymous"
  }
  next();
});

/**
 * Ensures req.profile has at least one of the given BusinessRoleType roles
 * (checked against the caller's own roles, fetched fresh from DB).
 */
const requireRole = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.profile) throw ApiError.unauthorized();

    const count = await prisma.businessRole.count({
      where: { profileId: req.profile.id, role: { in: roles } },
    });

    if (count === 0) {
      throw ApiError.forbidden(`Requires one of roles: ${roles.join(', ')}`);
    }
    next();
  });

const {
  requireVerifiedSession,
  protectStateChanges,
  isSessionVerified,
} = require('./verifiedSession.middleware');

module.exports = {
  requireAuth,
  requireRole,
  verifySupabaseToken,
  optionalAuth,
  requireVerifiedSession,
  protectStateChanges,
  isSessionVerified,
};
