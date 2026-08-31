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
    updateMany: jest.fn(),
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

  it('throws forbidden when webhook signature is invalid', async () => {
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

    prisma.membershipTransaction.findFirst.mockResolvedValue(null);

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

    prisma.membershipTransaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      status: 'PENDING',
      amount: 150000,
      membershipId: 'mem-1',
      membership: { profileId: 'prof-1', status: 'INACTIVE' },
      plan: { durationDays: 30, name: 'Gold' },
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

    prisma.membershipTransaction.findFirst.mockResolvedValue(existingTransaction);

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

    const pendingTransaction = {
      id: 'tx-1',
      status: 'PENDING',
      amount: 150000,
      invoiceNumber: orderId,
      membershipId: 'mem-1',
      planId: 'plan-1',
      membership: {
        id: 'mem-1',
        profileId: 'prof-1',
        status: 'INACTIVE',
        expiresAt: null,
        profile: {
          fullName: 'Budi Santoso',
          user: { email: 'budi@example.com' },
        },
      },
      plan: { id: 'plan-1', durationDays: 30, name: 'Gold Plan' },
    };

    prisma.membershipTransaction.findFirst.mockResolvedValue(pendingTransaction);
    prisma.membershipTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.membershipTransaction.findUnique.mockResolvedValue({
      ...pendingTransaction,
      status: 'PAID',
      paymentMethod: 'QRIS',
    });
    prisma.membership.update.mockResolvedValue({ id: 'mem-1', status: 'ACTIVE' });

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result.status).toBe('PAID');
    expect(prisma.membershipTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID', paymentMethod: 'QRIS' }),
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

    prisma.membershipTransaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      status: 'PENDING',
      amount: 150000,
      membershipId: 'mem-1',
      membership: { profileId: 'prof-1', status: 'INACTIVE' },
      plan: { durationDays: 30, name: 'Gold' },
    });
    prisma.membershipTransaction.updateMany.mockResolvedValue({ count: 0 });
    prisma.membershipTransaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: 'PAID',
    });

    const result = await membershipService.handlePaymentWebhook('MIDTRANS', payload);

    expect(result.status).toBe('PAID');
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });
});
