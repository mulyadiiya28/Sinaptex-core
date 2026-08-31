const crypto = require('crypto');
const membershipService = require('../../src/modules/membership/membership.service');
const prisma = require('../../src/config/prisma');
const PaymentGateway = require('../../src/core/payment/PaymentGateway');

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
  },
  notification: {
    create: jest.fn(),
  },
}));

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

  it('throws forbidden error when webhook signature is invalid', async () => {
    const payload = {
      order_id: 'INV-2026-001',
      status_code: '200',
      gross_amount: '150000',
      signature_key: 'invalid-signature-hash',
      transaction_status: 'settlement',
    };

    await expect(membershipService.handlePaymentWebhook('MIDTRANS', payload)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Invalid webhook signature',
    });
  });

  it('throws not found when transaction does not match any invoice or gateway ID', async () => {
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

    prisma.membershipTransaction.findFirst.mockResolvedValue(null);

    await expect(membershipService.handlePaymentWebhook('MIDTRANS', payload)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Transaction not found',
    });
  });

  it('handles idempotency cleanly when transaction is already in terminal state (PAID)', async () => {
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

    prisma.membershipTransaction.findFirst.mockResolvedValue(existingTransaction);

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result).toEqual(existingTransaction);
    expect(prisma.membershipTransaction.update).not.toHaveBeenCalled();
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it('successfully activates membership and sends notification when payment is settlement/capture', async () => {
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

    const pendingTransaction = {
      id: 'tx-1',
      status: 'PENDING',
      amount: 150000,
      invoiceNumber: orderId,
      membershipId: 'mem-1',
      membership: {
        id: 'mem-1',
        profileId: 'prof-1',
        profile: {
          fullName: 'Budi Santoso',
          user: { email: 'budi@example.com' },
        },
      },
      plan: { id: 'plan-1', durationDays: 30, name: 'Gold Plan' },
    };

    prisma.membershipTransaction.findFirst.mockResolvedValue(pendingTransaction);
    prisma.membershipTransaction.update.mockResolvedValue({
      ...pendingTransaction,
      status: 'PAID',
      paymentMethod: 'QRIS',
    });
    prisma.membership.update.mockResolvedValue({
      id: 'mem-1',
      status: 'ACTIVE',
    });

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result.status).toBe('PAID');
    expect(prisma.membershipTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: 'PAID',
          paymentMethod: 'QRIS',
        }),
      })
    );

    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        activatedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      }),
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'prof-1',
        type: 'MEMBERSHIP_ACTIVATED',
      }),
    });
  });
});
