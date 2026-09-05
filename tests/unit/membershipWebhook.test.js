// tests/unit/membershipWebhook.test.js
const crypto = require('crypto');
const PaymentGateway = require('../../src/core/payment/PaymentGateway');

// Mock membership service BEFORE importing
jest.mock('../../src/modules/membership/membership.service', () => ({
  handlePaymentWebhook: jest.fn(),
  hasActiveMembership: jest.fn(),
  getActiveMembership: jest.fn(),
  getOrCreateMembership: jest.fn(),
  invalidateMembershipCache: jest.fn(),
  listPlans: jest.fn(),
  checkout: jest.fn(),
  listMyTransactions: jest.fn(),
  devActivate: jest.fn(),
  expireMembershipsAndTransitionTier: jest.fn(),
  processExpiredMemberships: jest.fn(),
  amountsMatch: jest.fn(),
}));

// Mock prisma
jest.mock('../../src/config/prisma', () => ({
  membership: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  membershipTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
}));

// Import setelah mock
const membershipService = require('../../src/modules/membership/membership.service');
const prisma = require('../../src/config/prisma');

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-mail-id' }),
}));

describe('Midtrans Webhook & Membership Activation', () => {
  const mockServerKey = 'SB-Mid-server-TESTKEY123';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = mockServerKey;
    const midtrans = PaymentGateway.of('MIDTRANS');
    midtrans.config.serverKey = mockServerKey;
  });

  function createMidtransSignature(orderId, statusCode, grossAmount) {
    return crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${mockServerKey}`)
      .digest('hex');
  }

  it('throws forbidden when webhook signature is invalid', async () => {
    const payload = {
      order_id: 'INV-2026-001',
      status_code: '200',
      gross_amount: '150000',
      signature_key: 'invalid-signature-hash',
      transaction_status: 'settlement',
    };

    membershipService.handlePaymentWebhook.mockRejectedValue({
      statusCode: 403,
      message: 'Invalid webhook signature',
    });

    await expect(membershipService.handlePaymentWebhook('MIDTRANS', payload)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Invalid webhook signature',
    });
  });

  it('acknowledges unknown order with valid signature (no 404)', async () => {
    const orderId = 'INV-2026-MISSING';
    const signatureKey = createMidtransSignature(orderId, '200', '150000');

    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '150000',
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
    };

    membershipService.handlePaymentWebhook.mockResolvedValue({
      acknowledged: true,
      reason: 'UNKNOWN_ORDER',
      orderId,
    });

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);
    expect(result).toMatchObject({
      acknowledged: true,
      reason: 'UNKNOWN_ORDER',
      orderId,
    });
  });

  it('rejects amount mismatch on PAID notification', async () => {
    const orderId = 'INV-2026-AMT';
    const signatureKey = createMidtransSignature(orderId, '200', '999999');

    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '999999',
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'qris',
    };

    membershipService.handlePaymentWebhook.mockRejectedValue({
      statusCode: 403,
      message: 'Webhook amount mismatch',
    });

    await expect(membershipService.handlePaymentWebhook('MIDTRANS', payload)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Webhook amount mismatch',
    });
    expect(prisma.membershipTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('handles idempotency when transaction already PAID', async () => {
    const orderId = 'INV-2026-PAID-ALREADY';
    const signatureKey = createMidtransSignature(orderId, '200', '150000');

    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '150000',
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'gopay',
    };

    const existingTransaction = {
      id: 'tx-1',
      status: 'PAID',
      amount: 150000,
      membershipId: 'mem-1',
      membership: { profileId: 'prof-1' },
      plan: { durationDays: 30, name: 'Gold' },
    };

    membershipService.handlePaymentWebhook.mockResolvedValue(existingTransaction);

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result).toEqual(existingTransaction);
    expect(prisma.membershipTransaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it('activates membership via atomic claim on settlement', async () => {
    const orderId = 'INV-2026-SUCCESS';
    const signatureKey = createMidtransSignature(orderId, '200', '150000');

    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '150000',
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'qris',
    };

    const paidTransaction = {
      id: 'tx-1',
      status: 'PAID',
      amount: 150000,
      invoiceNumber: orderId,
      membershipId: 'mem-1',
      planId: 'plan-1',
      paymentMethod: 'QRIS',
      membership: {
        id: 'mem-1',
        profileId: 'prof-1',
        status: 'ACTIVE',
        profile: {
          fullName: 'Budi Santoso',
          user: { email: 'budi@example.com' },
        },
      },
      plan: { id: 'plan-1', durationDays: 30, name: 'Gold Plan' },
    };

    membershipService.handlePaymentWebhook.mockResolvedValue(paidTransaction);

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result.status).toBe('PAID');
    expect(result.paymentMethod).toBe('QRIS');
  });

  it('does not double-activate when atomic claim loses race', async () => {
    const orderId = 'INV-2026-RACE';
    const signatureKey = createMidtransSignature(orderId, '200', '150000');

    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '150000',
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'qris',
    };

    const paidTransaction = {
      id: 'tx-1',
      status: 'PAID',
      amount: 150000,
      membershipId: 'mem-1',
      membership: { profileId: 'prof-1', status: 'ACTIVE' },
      plan: { durationDays: 30, name: 'Gold' },
    };

    membershipService.handlePaymentWebhook.mockResolvedValue(paidTransaction);

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result.status).toBe('PAID');
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });
});