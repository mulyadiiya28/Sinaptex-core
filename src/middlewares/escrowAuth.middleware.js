const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError'); 
const ErrorCodes = require('../utils/errorCodes');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Pure policy validator for escrow party ownership.
 *
 * @param {object} profile - Local user profile record from `req.profile`
 * @param {object} party - Escrow party DB record
 * @param {object} [options]
 * @param {boolean} [options.requireVerification=false] - Enforce party verification
 * @returns {{ allowed: boolean, statusCode?: number, code?: string, message?: string }}
 */
function verifyEscrowPartyOwnership(profile, party, options = {}) {
  const { requireVerification = false } = options;

  if (!profile) {
    return {
      allowed: false,
      statusCode: 401,
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Authentication required for escrow operations',
    };
  }

  if (!party) {
    return {
      allowed: false,
      statusCode: 404,
      code: ErrorCodes.NOT_FOUND,
      message: 'Target party for escrow transaction not found',
    };
  }

  if (party.ownerId !== profile.id) {
    return {
      allowed: false,
      statusCode: 403,
      code: ErrorCodes.ESCROW_PARTY_MISMATCH,
      message: 'You do not have permission to execute escrow operations on behalf of this party',
    };
  }

  if (requireVerification && party.verification?.status !== 'VERIFIED') {
    return {
      allowed: false,
      statusCode: 403,
      code: ErrorCodes.ESCROW_NOT_VERIFIED,
      message: 'Escrow operation requires party to have a VERIFIED status',
    };
  }

  return { allowed: true };
}

/**
 * Pure policy validator for escrow transaction participation.
 *
 * @param {object} profile - Local user profile record from `req.profile`
 * @param {object} escrow - Escrow transaction record with buyerParty & sellerParty
 * @param {'BUYER' | 'SELLER' | 'ANY' | 'ADMIN'} requiredParticipantRole - Role required for the action
 * @returns {{ allowed: boolean, statusCode?: number, code?: string, message?: string, isBuyer?: boolean, isSeller?: boolean, isAdmin?: boolean }}
 */
function verifyEscrowParticipation(profile, escrow, requiredParticipantRole = 'ANY') {
  if (!profile) {
    return {
      allowed: false,
      statusCode: 401,
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Authentication required for escrow operations',
    };
  }

  if (!escrow) {
    return {
      allowed: false,
      statusCode: 404,
      code: ErrorCodes.ESCROW_NOT_FOUND,
      message: 'Escrow transaction not found',
    };
  }

  const isAdmin =
    profile.role === 'ADMIN' ||
    profile.role === 'SUPER_ADMIN' ||
    profile.isAdmin === true;

  const isBuyerOwner = escrow.buyerParty?.ownerId === profile.id;
  const isSellerOwner = escrow.sellerParty?.ownerId === profile.id;

  if (requiredParticipantRole === 'ADMIN') {
    if (!isAdmin) {
      return {
        allowed: false,
        statusCode: 403,
        code: ErrorCodes.ESCROW_UNAUTHORIZED,
        message: 'Admin authorization required for this escrow action',
      };
    }
    return {
      allowed: true,
      isAdmin: true,
      isBuyer: isBuyerOwner,
      isSeller: isSellerOwner,
    };
  }

  if (requiredParticipantRole === 'BUYER' && !isBuyerOwner && !isAdmin) {
    return {
      allowed: false,
      statusCode: 403,
      code: ErrorCodes.ESCROW_UNAUTHORIZED,
      message: 'Only the buyer party owner is authorized to perform this escrow action',
    };
  }

  if (requiredParticipantRole === 'SELLER' && !isSellerOwner && !isAdmin) {
    return {
      allowed: false,
      statusCode: 403,
      code: ErrorCodes.ESCROW_UNAUTHORIZED,
      message: 'Only the seller party owner is authorized to perform this escrow action',
    };
  }

  if (
    requiredParticipantRole === 'ANY' &&
    !isBuyerOwner &&
    !isSellerOwner &&
    !isAdmin
  ) {
    return {
      allowed: false,
      statusCode: 403,
      code: ErrorCodes.ESCROW_UNAUTHORIZED,
      message: 'You are not an authorized participant in this escrow transaction',
    };
  }

  return {
    allowed: true,
    isBuyer: isBuyerOwner,
    isSeller: isSellerOwner,
    isAdmin,
  };
}

/**
 * Validates that the current user owns the party specified in req.body, req.params, or req.query.
 *
 * @param {object} [options]
 * @param {string} [options.partyIdParam='partyId'] - Name of param/body field containing party ID
 * @param {boolean} [options.requireVerification=false] - Whether the party must be VERIFIED
 */
const requireEscrowPartyOwner = ({
  partyIdParam = 'partyId',
  requireVerification = false,
} = {}) =>
  asyncHandler(async (req, res, next) => {
    if (!req.profile) {
      throw ApiError.unauthorized(
        'Authentication required for escrow operations',
        ErrorCodes.UNAUTHORIZED
      );
    }

    const partyId =
      req.params[partyIdParam] ||
      req.body[partyIdParam] ||
      req.query[partyIdParam] ||
      req.body.buyerPartyId ||
      req.body.sellerPartyId;

    if (!partyId || typeof partyId !== 'string') {
      throw ApiError.badRequest(
        `Missing or invalid party identifier (${partyIdParam}) for escrow operation`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        verification: true,
      },
    });

    const check = verifyEscrowPartyOwnership(req.profile, party, {
      requireVerification,
    });

    if (!check.allowed) {
      throw new ApiError(check.statusCode, check.message, null, check.code);
    }

    req.escrowParty = party;
    next();
  });

/**
 * Validates that the authenticated user is an authorized participant in an existing EscrowTransaction.
 *
 * @param {'BUYER' | 'SELLER' | 'ANY' | 'ADMIN'} [requiredParticipantRole='ANY'] - Role required for the operation
 */
const requireEscrowParticipant = (requiredParticipantRole = 'ANY') =>
  asyncHandler(async (req, res, next) => {
    if (!req.profile) {
      throw ApiError.unauthorized(
        'Authentication required for escrow operations',
        ErrorCodes.UNAUTHORIZED
      );
    }

    const escrowId =
      req.params.escrowId || req.params.id || req.body.escrowId;

    if (!escrowId || typeof escrowId !== 'string') {
      throw ApiError.badRequest(
        'Missing or invalid escrow transaction ID',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id: escrowId },
      include: {
        buyerParty: true,
        sellerParty: true,
        deal: true,
      },
    });

    const check = verifyEscrowParticipation(
      req.profile,
      escrow,
      requiredParticipantRole
    );

    if (!check.allowed) {
      throw new ApiError(check.statusCode, check.message, null, check.code);
    }

    req.escrow = escrow;
    req.isEscrowBuyer = check.isBuyer;
    req.isEscrowSeller = check.isSeller;
    req.isEscrowAdmin = check.isAdmin || false;
    next();
  });

module.exports = {
  verifyEscrowPartyOwnership,
  verifyEscrowParticipation,
  requireEscrowPartyOwner,
  requireEscrowParticipant,
};