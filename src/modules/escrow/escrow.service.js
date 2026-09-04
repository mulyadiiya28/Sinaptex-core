const crypto = require('crypto');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');
const logger = require('../../core/logger');
const { sendEmail } = require('../../utils/mailer');

/**
 * Generates an alphanumeric tracking reference for escrow events.
 */
function generateReference(prefix = 'ESC') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Fail-closed ownership assertion.
 * Internal/system callers must explicitly pass isSystemCall: true.
 * Default is safe (requires a valid callerProfileId that matches ownerId).
 */
function assertOwnerOrSystem(ownerId, callerProfileId, { isSystemCall = false } = {}) {
  if (isSystemCall) return;
  if (!callerProfileId) {
    throw ApiError.unauthorized(
      'Missing caller identity for escrow operation',
      ErrorCodes.UNAUTHORIZED
    );
  }
  if (ownerId !== callerProfileId) {
    throw ApiError.forbidden(
      'Only the party owner can perform this escrow action',
      ErrorCodes.ESCROW_UNAUTHORIZED
    );
  }
}

/**
 * Fail-closed participant assertion (buyer OR seller).
 */
function assertParticipantOrSystem(escrow, callerProfileId, { isSystemCall = false } = {}) {
  if (isSystemCall) return;
  if (!callerProfileId) {
    throw ApiError.unauthorized(
      'Missing caller identity for escrow operation',
      ErrorCodes.UNAUTHORIZED
    );
  }
  const isBuyer = escrow.buyerParty?.ownerId === callerProfileId;
  const isSeller = escrow.sellerParty?.ownerId === callerProfileId;
  if (!isBuyer && !isSeller) {
    throw ApiError.forbidden(
      'You are not an authorized participant in this escrow transaction',
      ErrorCodes.ESCROW_UNAUTHORIZED
    );
  }
}

/**
 * Helper to dispatch notification and email safely.
 */
async function notifyEscrowParticipant({ profileId, email, type, title, message, data = {} }) {
  if (profileId) {
    try {
      await prisma.notification.create({
        data: {
          profileId,
          type,
          title,
          message,
          data,
        },
      });
    } catch (err) {
      logger.error('Failed to create in-app notification for escrow event', {
        error: err.message,
        profileId,
        type,
      });
    }
  }

  if (email) {
    try {
      await sendEmail({
        to: email,
        subject: `[Sinaptex Escrow] ${title}`,
        text: `${message}\n\nReferensi Escrow: ${data.escrowId || '-'}\nStatus: ${data.status || '-'}`,
      });
    } catch (err) {
      logger.error('Failed to send escrow email', { error: err.message, email, type });
    }
  }
}

/**
 * 1. Initiate an Escrow Hold
 * Locks transaction funds in escrow.
 */
async function initiateHold({
  buyerPartyId,
  sellerPartyId,
  amount,
  fee = 0,
  currency = 'IDR',
  dealId = null,
  notes = null,
  metadata = null,
  callerProfileId = null,
  isSystemCall = false,
}) {
  if (!buyerPartyId || !sellerPartyId) {
    throw ApiError.badRequest(
      'Both buyerPartyId and sellerPartyId are required',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  if (buyerPartyId === sellerPartyId) {
    throw ApiError.badRequest(
      'Buyer party and seller party cannot be identical',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw ApiError.badRequest(
      'Escrow amount must be a positive number',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  const [buyerParty, sellerParty] = await Promise.all([
    prisma.party.findUnique({
      where: { id: buyerPartyId },
      include: { owner: { include: { user: true } } },
    }),
    prisma.party.findUnique({
      where: { id: sellerPartyId },
      include: { owner: { include: { user: true } } },
    }),
  ]);

  if (!buyerParty) {
    throw ApiError.notFound('Buyer party not found', ErrorCodes.NOT_FOUND);
  }
  if (!sellerParty) {
    throw ApiError.notFound('Seller party not found', ErrorCodes.NOT_FOUND);
  }

  assertOwnerOrSystem(buyerParty.ownerId, callerProfileId, { isSystemCall });

  if (dealId) {
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw ApiError.notFound('Referenced deal not found', ErrorCodes.NOT_FOUND);
    }
  }

  const holdReference = generateReference('ESC-HOLD');
  const now = new Date();

  const escrow = await prisma.escrowTransaction.create({
    data: {
      dealId: dealId || null,
      buyerPartyId,
      sellerPartyId,
      amount: parsedAmount,
      fee: parseFloat(fee) || 0,
      currency,
      status: 'HELD',
      holdReference,
      heldAt: now,
      notes: notes || null,
      metadata: metadata || null,
    },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (dealId) {
    await prisma.deal.update({
      where: { id: dealId },
      data: { status: 'IN_PROGRESS', startAt: now },
    });
  }

  logger.info('Escrow hold successfully initiated', {
    escrowId: escrow.id,
    holdReference,
    amount: parsedAmount,
    buyerPartyId,
    sellerPartyId,
  });

  await notifyEscrowParticipant({
    profileId: sellerParty.ownerId,
    email: sellerParty.owner?.user?.email,
    type: 'ESCROW_FUNDS_HELD',
    title: 'Dana Escrow Telah Diamankan',
    message: `Pembeli (${buyerParty.name}) telah mengunci dana sebesar Rp ${parsedAmount.toLocaleString('id-ID')} pada transaksi escrow.`,
    data: { escrowId: escrow.id, holdReference, status: 'HELD', amount: parsedAmount },
  });

  return escrow;
}

/**
 * 2. Final Release of Funds
 * Releases the escrow balance to the seller's account.
 */
async function releaseFunds({
  escrowId,
  callerProfileId = null,
  notes = null,
  isSystemCall = false,
}) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  assertOwnerOrSystem(escrow.buyerParty.ownerId, callerProfileId, { isSystemCall });

  const allowedStatuses = ['HELD', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED'];
  if (!allowedStatuses.includes(escrow.status)) {
    throw ApiError.badRequest(
      `Cannot release escrow in status ${escrow.status}`,
      ErrorCodes.ESCROW_INVALID_STATE
    );
  }

  const now = new Date();
  const releaseReference = generateReference('ESC-REL');

  const formattedNotes = notes
    ? `${escrow.notes ? `${escrow.notes}\n` : ''}[Release] ${notes}`
    : escrow.notes;

  const updatedEscrow = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: {
      status: 'RELEASED',
      releasedAt: now,
      buyerConfirmedAt: escrow.buyerConfirmedAt || now,
      releaseReference,
      notes: formattedNotes,
    },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (escrow.dealId) {
    await prisma.deal.update({
      where: { id: escrow.dealId },
      data: {
        status: 'COMPLETED',
        endAt: now,
      },
    });
  }

  logger.info('Escrow funds successfully released', {
    escrowId,
    releaseReference,
    amount: escrow.amount,
    sellerPartyId: escrow.sellerPartyId,
  });

  await notifyEscrowParticipant({
    profileId: escrow.sellerParty.ownerId,
    email: escrow.sellerParty.owner?.user?.email,
    type: 'ESCROW_FUNDS_RELEASED',
    title: 'Dana Escrow Telah Dilepaskan!',
    message: `Dana sebesar Rp ${escrow.amount.toLocaleString('id-ID')} telah berhasil dilepaskan ke saldo/rekening Anda dengan referensi ${releaseReference}.`,
    data: { escrowId, releaseReference, status: 'RELEASED', amount: escrow.amount },
  });

  await notifyEscrowParticipant({
    profileId: escrow.buyerParty.ownerId,
    email: escrow.buyerParty.owner?.user?.email,
    type: 'ESCROW_SETTLED',
    title: 'Transaksi Escrow Selesai',
    message: `Transaksi escrow untuk pesanan ke ${escrow.sellerParty.name} telah selesai dan dana telah diteruskan ke pihak penjual.`,
    data: { escrowId, releaseReference, status: 'RELEASED' },
  });

  return updatedEscrow;
}

/**
 * 3. Seller Confirmation (Fulfillment / Dispatch)
 * Indicates the seller has delivered or fulfilled their side of the agreement.
 */
async function confirmBySeller({
  escrowId,
  callerProfileId = null,
  notes = null,
  metadata = null,
  isSystemCall = false,
}) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  assertOwnerOrSystem(escrow.sellerParty.ownerId, callerProfileId, { isSystemCall });

  if (escrow.status !== 'HELD' && escrow.status !== 'BUYER_CONFIRMED') {
    throw ApiError.badRequest(
      `Cannot confirm fulfillment for escrow in status ${escrow.status}`,
      ErrorCodes.ESCROW_INVALID_STATE
    );
  }

  const now = new Date();
  const nextStatus = 'SELLER_CONFIRMED';
  const formattedNotes = notes
    ? `${escrow.notes ? `${escrow.notes}\n` : ''}[Seller] ${notes}`
    : escrow.notes;

  const updatedEscrow = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: {
      sellerConfirmedAt: now,
      status: nextStatus,
      notes: formattedNotes,
      metadata: metadata ? { ...(escrow.metadata || {}), ...metadata } : escrow.metadata,
    },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  logger.info('Escrow seller fulfillment confirmed', { escrowId, sellerPartyId: escrow.sellerPartyId });

  await notifyEscrowParticipant({
    profileId: escrow.buyerParty.ownerId,
    email: escrow.buyerParty.owner?.user?.email,
    type: 'ESCROW_SELLER_FULFILLED',
    title: 'Penjual Telah Menyelesaikan Pemenuhan',
    message: `Penjual (${escrow.sellerParty.name}) telah mengonfirmasi pemenuhan pesanan untuk transaksi escrow.`,
    data: { escrowId, status: nextStatus },
  });

  return updatedEscrow;
}

/**
 * 4. Buyer Confirmation (Receipt / Acceptance)
 * Indicates the buyer has received and inspected the delivered goods or services.
 */
async function confirmByBuyer({
  escrowId,
  callerProfileId = null,
  notes = null,
  autoRelease = false,
  isSystemCall = false,
}) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  assertOwnerOrSystem(escrow.buyerParty.ownerId, callerProfileId, { isSystemCall });

  if (escrow.status !== 'HELD' && escrow.status !== 'SELLER_CONFIRMED') {
    throw ApiError.badRequest(
      `Cannot confirm delivery for escrow in status ${escrow.status}`,
      ErrorCodes.ESCROW_INVALID_STATE
    );
  }

  const now = new Date();

  if (autoRelease) {
    return releaseFunds({ escrowId, callerProfileId, notes });
  }

  const formattedNotes = notes
    ? `${escrow.notes ? `${escrow.notes}\n` : ''}[Buyer] ${notes}`
    : escrow.notes;

  const updatedEscrow = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: {
      buyerConfirmedAt: now,
      status: 'BUYER_CONFIRMED',
      notes: formattedNotes,
    },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  logger.info('Escrow buyer delivery confirmed', { escrowId, buyerPartyId: escrow.buyerPartyId });

  await notifyEscrowParticipant({
    profileId: escrow.sellerParty.ownerId,
    email: escrow.sellerParty.owner?.user?.email,
    type: 'ESCROW_BUYER_ACCEPTED',
    title: 'Pembeli Mengonfirmasi Penerimaan',
    message: `Pembeli (${escrow.buyerParty.name}) telah mengonfirmasi penerimaan barang/jasa.`,
    data: { escrowId, status: 'BUYER_CONFIRMED' },
  });

  return updatedEscrow;
}

/**
 * 5. Refund Escrow
 * Returns held funds back to the buyer.
 */
async function refundEscrow({
  escrowId,
  callerProfileId = null,
  reason = 'Mutual cancellation',
  isSystemCall = false,
}) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  assertParticipantOrSystem(escrow, callerProfileId, { isSystemCall });

  const refundableStatuses = [
    'HELD',
    'DISPUTED',
    'PENDING_HOLD',
    'BUYER_CONFIRMED',
    'SELLER_CONFIRMED',
  ];
  if (!refundableStatuses.includes(escrow.status)) {
    throw ApiError.badRequest(
      `Cannot refund escrow in status ${escrow.status}`,
      ErrorCodes.ESCROW_INVALID_STATE
    );
  }

  const now = new Date();
  const refundReference = generateReference('ESC-REF');
  const formattedNotes = `${escrow.notes ? `${escrow.notes}\n` : ''}[Refund] ${reason}`;

  const updatedEscrow = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: {
      status: 'REFUNDED',
      refundedAt: now,
      refundReference,
      notes: formattedNotes,
    },
    include: {
      buyerParty: true,
      sellerParty: true,
      deal: true,
    },
  });

  if (escrow.dealId) {
    await prisma.deal.update({
      where: { id: escrow.dealId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        endAt: now,
      },
    });
  }

  logger.info('Escrow refunded to buyer', {
    escrowId,
    refundReference,
    buyerPartyId: escrow.buyerPartyId,
  });

  await notifyEscrowParticipant({
    profileId: escrow.buyerParty.ownerId,
    email: escrow.buyerParty.owner?.user?.email,
    type: 'ESCROW_REFUNDED',
    title: 'Dana Escrow Telah Dikembalikan',
    message: `Dana transaksi sebesar Rp ${escrow.amount.toLocaleString('id-ID')} telah dikembalikan ke akun Anda.`,
    data: { escrowId, refundReference, status: 'REFUNDED' },
  });

  return updatedEscrow;
}

/**
 * 6. Dispute Escrow
 * Flags escrow for dispute resolution.
 */
async function disputeEscrow({
  escrowId,
  callerProfileId = null,
  disputeReason,
  isSystemCall = false,
}) {
  if (!disputeReason) {
    throw ApiError.badRequest('Dispute reason is required', ErrorCodes.VALIDATION_ERROR);
  }

  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: { include: { owner: { include: { user: true } } } },
      sellerParty: { include: { owner: { include: { user: true } } } },
      deal: true,
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  assertParticipantOrSystem(escrow, callerProfileId, { isSystemCall });

  if (escrow.status === 'RELEASED' || escrow.status === 'REFUNDED' || escrow.status === 'CANCELLED') {
    throw ApiError.badRequest(
      `Cannot dispute an escrow in ${escrow.status} status`,
      ErrorCodes.ESCROW_INVALID_STATE
    );
  }

  const now = new Date();
  const updatedEscrow = await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: {
      status: 'DISPUTED',
      disputedAt: now,
      disputeReason,
    },
    include: {
      buyerParty: true,
      sellerParty: true,
      deal: true,
    },
  });

  logger.warn('Escrow transaction placed in dispute', { escrowId, disputeReason, callerProfileId });

  return updatedEscrow;
}

/**
 * 7. Get Escrow By ID
 * Authorization: caller must be a participant (buyer/seller owner) unless isAdmin.
 */
async function getEscrowById(escrowId, { callerProfileId = null, isAdmin = false } = {}) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: escrowId },
    include: {
      buyerParty: {
        include: {
          owner: { select: { id: true, fullName: true, companyName: true, avatarUrl: true } },
          verification: true,
        },
      },
      sellerParty: {
        include: {
          owner: { select: { id: true, fullName: true, companyName: true, avatarUrl: true } },
          verification: true,
        },
      },
      deal: {
        include: {
          invitation: {
            include: {
              opportunity: { select: { id: true, title: true, type: true } },
            },
          },
        },
      },
    },
  });

  if (!escrow) {
    throw ApiError.notFound('Escrow transaction not found', ErrorCodes.ESCROW_NOT_FOUND);
  }

  if (!isAdmin) {
    if (!callerProfileId) {
      throw ApiError.unauthorized(
        'Missing caller identity for escrow operation',
        ErrorCodes.UNAUTHORIZED
      );
    }
    const isParticipant =
      escrow.buyerParty.ownerId === callerProfileId ||
      escrow.sellerParty.ownerId === callerProfileId;
    if (!isParticipant) {
      throw ApiError.forbidden(
        'You are not an authorized participant in this escrow transaction',
        ErrorCodes.ESCROW_UNAUTHORIZED
      );
    }
  }

  return escrow;
}

/**
 * 8. List Escrows with filters & pagination
 * Always scopes results to the caller's profileId.
 * partyId is an additional filter only after ownership is verified.
 */
async function listEscrowTransactions({
  partyId = null,
  profileId = null,
  status = null,
  page = 1,
  limit = 20,
}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (pageNum - 1) * take;

  const where = {};
  if (status) {
    where.status = status;
  }

  // Always scope to caller's profile first — never allow unscoped listing.
  if (profileId) {
    where.OR = [
      { buyerParty: { ownerId: profileId } },
      { sellerParty: { ownerId: profileId } },
    ];
  }

  if (partyId) {
    // partyId is only allowed as an additional filter when the caller owns that party.
    if (profileId) {
      const owns = await prisma.party.findFirst({
        where: { id: partyId, ownerId: profileId },
        select: { id: true },
      });
      if (!owns) {
        throw ApiError.forbidden(
          'You do not own the specified party',
          ErrorCodes.ESCROW_PARTY_MISMATCH
        );
      }
    }
    // Narrow to the specific party while remaining inside the ownership scope.
    where.AND = [{ OR: [{ buyerPartyId: partyId }, { sellerPartyId: partyId }] }];
    // Prefer the more specific party filter; ownership already verified above.
    delete where.OR;
  }

  const [items, total] = await Promise.all([
    prisma.escrowTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        buyerParty: { select: { id: true, name: true, ownerId: true, verificationStatus: true } },
        sellerParty: { select: { id: true, name: true, ownerId: true, verificationStatus: true } },
        deal: { select: { id: true, status: true } },
      },
    }),
    prisma.escrowTransaction.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take) || 1;

  return {
    items,
    meta: {
      page: pageNum,
      limit: take,
      total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    },
  };
}

module.exports = {
  generateReference,
  assertOwnerOrSystem,
  assertParticipantOrSystem,
  initiateHold,
  confirmBySeller,
  confirmByBuyer,
  releaseFunds,
  refundEscrow,
  disputeEscrow,
  getEscrowById,
  listEscrowTransactions,
};
