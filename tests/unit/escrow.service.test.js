const escrowService = require('../../src/modules/escrow/escrow.service');
const prisma = require('../../src/config/prisma');

jest.mock('../../src/config/prisma', () => ({
  party: {
    findUnique: jest.fn(),
  },
  deal: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  escrowTransaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
}));

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-mail-id' }),
}));

describe('Escrow Transaction Lifecycle Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateHold', () => {
    it('throws validation error when buyer and seller are identical', async () => {
      await expect(
        escrowService.initiateHold({
          buyerPartyId: 'party-1',
          sellerPartyId: 'party-1',
          amount: 500000,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('cannot be identical'),
      });
    });

    it('throws validation error for invalid amount', async () => {
      await expect(
        escrowService.initiateHold({
          buyerPartyId: 'party-1',
          sellerPartyId: 'party-2',
          amount: -1000,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('positive number'),
      });
    });

    it('throws not found if buyer or seller party is missing', async () => {
      prisma.party.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'party-2', ownerId: 'owner-2' });

      await expect(
        escrowService.initiateHold({
          buyerPartyId: 'party-1',
          sellerPartyId: 'party-2',
          amount: 1000000,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Buyer party not found',
      });
    });

    it('throws forbidden if caller is not the buyer party owner', async () => {
      prisma.party.findUnique
        .mockResolvedValueOnce({ id: 'party-1', ownerId: 'owner-1', name: 'Buyer Co' })
        .mockResolvedValueOnce({ id: 'party-2', ownerId: 'owner-2', name: 'Seller Co' });

      await expect(
        escrowService.initiateHold({
          buyerPartyId: 'party-1',
          sellerPartyId: 'party-2',
          amount: 1000000,
          callerProfileId: 'stranger-profile',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('successfully initiates escrow hold and updates deal if dealId provided', async () => {
      const buyerParty = {
        id: 'party-1',
        ownerId: 'owner-1',
        name: 'Buyer Co',
        owner: { id: 'owner-1', user: { email: 'buyer@example.com' } },
      };
      const sellerParty = {
        id: 'party-2',
        ownerId: 'owner-2',
        name: 'Seller Co',
        owner: { id: 'owner-2', user: { email: 'seller@example.com' } },
      };

      prisma.party.findUnique
        .mockResolvedValueOnce(buyerParty)
        .mockResolvedValueOnce(sellerParty);

      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-101' });

      const createdEscrow = {
        id: 'escrow-1',
        buyerPartyId: 'party-1',
        sellerPartyId: 'party-2',
        amount: 2500000,
        fee: 25000,
        currency: 'IDR',
        status: 'HELD',
        holdReference: 'ESC-HOLD-XYZ',
        heldAt: new Date(),
        dealId: 'deal-101',
        buyerParty,
        sellerParty,
      };

      prisma.escrowTransaction.create.mockResolvedValue(createdEscrow);
      prisma.deal.update.mockResolvedValue({ id: 'deal-101', status: 'IN_PROGRESS' });

      const result = await escrowService.initiateHold({
        buyerPartyId: 'party-1',
        sellerPartyId: 'party-2',
        amount: 2500000,
        fee: 25000,
        dealId: 'deal-101',
        callerProfileId: 'owner-1',
      });

      expect(result.status).toBe('HELD');
      expect(prisma.escrowTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            buyerPartyId: 'party-1',
            sellerPartyId: 'party-2',
            amount: 2500000,
            status: 'HELD',
          }),
        })
      );
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-101' },
          data: expect.objectContaining({ status: 'IN_PROGRESS' }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'owner-2',
            type: 'ESCROW_FUNDS_HELD',
          }),
        })
      );
    });
  });

  describe('confirmBySeller', () => {
    it('throws forbidden when caller is not the seller party owner', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        id: 'escrow-1',
        sellerPartyId: 'party-2',
        status: 'HELD',
        buyerParty: { ownerId: 'owner-1' },
        sellerParty: { ownerId: 'owner-2', name: 'Seller Co' },
      });

      await expect(
        escrowService.confirmBySeller({
          escrowId: 'escrow-1',
          callerProfileId: 'not-the-seller',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('successfully confirms seller fulfillment and notifies buyer', async () => {
      const escrow = {
        id: 'escrow-1',
        sellerPartyId: 'party-2',
        status: 'HELD',
        buyerParty: { ownerId: 'owner-1', name: 'Buyer Co', owner: { user: { email: 'buyer@test.com' } } },
        sellerParty: { ownerId: 'owner-2', name: 'Seller Co', owner: { user: { email: 'seller@test.com' } } },
      };

      prisma.escrowTransaction.findUnique.mockResolvedValue(escrow);
      prisma.escrowTransaction.update.mockResolvedValue({
        ...escrow,
        status: 'SELLER_CONFIRMED',
        sellerConfirmedAt: new Date(),
      });

      const result = await escrowService.confirmBySeller({
        escrowId: 'escrow-1',
        callerProfileId: 'owner-2',
        notes: 'Barang telah dikirim via kurir kilat',
      });

      expect(result.status).toBe('SELLER_CONFIRMED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'escrow-1' },
          data: expect.objectContaining({
            status: 'SELLER_CONFIRMED',
            sellerConfirmedAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'owner-1',
            type: 'ESCROW_SELLER_FULFILLED',
          }),
        })
      );
    });
  });

  describe('confirmByBuyer', () => {
    it('throws forbidden when caller is not the buyer party owner', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        id: 'escrow-1',
        buyerPartyId: 'party-1',
        status: 'HELD',
        buyerParty: { ownerId: 'owner-1' },
        sellerParty: { ownerId: 'owner-2' },
      });

      await expect(
        escrowService.confirmByBuyer({
          escrowId: 'escrow-1',
          callerProfileId: 'imposter-buyer',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('successfully confirms buyer receipt and updates status to BUYER_CONFIRMED', async () => {
      const escrow = {
        id: 'escrow-1',
        buyerPartyId: 'party-1',
        status: 'SELLER_CONFIRMED',
        buyerParty: { ownerId: 'owner-1', name: 'Buyer Co', owner: { user: { email: 'buyer@test.com' } } },
        sellerParty: { ownerId: 'owner-2', name: 'Seller Co', owner: { user: { email: 'seller@test.com' } } },
      };

      prisma.escrowTransaction.findUnique.mockResolvedValue(escrow);
      prisma.escrowTransaction.update.mockResolvedValue({
        ...escrow,
        status: 'BUYER_CONFIRMED',
        buyerConfirmedAt: new Date(),
      });

      const result = await escrowService.confirmByBuyer({
        escrowId: 'escrow-1',
        callerProfileId: 'owner-1',
        notes: 'Barang diterima lengkap dan sesuai spesifikasi',
      });

      expect(result.status).toBe('BUYER_CONFIRMED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'escrow-1' },
          data: expect.objectContaining({
            status: 'BUYER_CONFIRMED',
            buyerConfirmedAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'owner-2',
            type: 'ESCROW_BUYER_ACCEPTED',
          }),
        })
      );
    });
  });

  describe('releaseFunds', () => {
    it('throws error when escrow is in invalid state for release', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        id: 'escrow-1',
        status: 'CANCELLED',
        buyerParty: { ownerId: 'owner-1' },
        sellerParty: { ownerId: 'owner-2' },
      });

      await expect(
        escrowService.releaseFunds({
          escrowId: 'escrow-1',
          callerProfileId: 'owner-1',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Cannot release escrow in status CANCELLED'),
      });
    });

    it('releases funds, updates Deal to COMPLETED, and notifies both parties', async () => {
      const escrow = {
        id: 'escrow-1',
        dealId: 'deal-101',
        amount: 5000000,
        status: 'BUYER_CONFIRMED',
        buyerParty: { ownerId: 'owner-1', name: 'Buyer Co', owner: { user: { email: 'buyer@test.com' } } },
        sellerParty: { ownerId: 'owner-2', name: 'Seller Co', owner: { user: { email: 'seller@test.com' } } },
      };

      prisma.escrowTransaction.findUnique.mockResolvedValue(escrow);
      prisma.escrowTransaction.update.mockResolvedValue({
        ...escrow,
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseReference: 'ESC-REL-ABC123',
      });
      prisma.deal.update.mockResolvedValue({ id: 'deal-101', status: 'COMPLETED' });

      const result = await escrowService.releaseFunds({
        escrowId: 'escrow-1',
        callerProfileId: 'owner-1',
        notes: 'Pelepasan final disetujui',
      });

      expect(result.status).toBe('RELEASED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'escrow-1' },
          data: expect.objectContaining({
            status: 'RELEASED',
            releasedAt: expect.any(Date),
            releaseReference: expect.any(String),
          }),
        })
      );
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-101' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'owner-2',
            type: 'ESCROW_FUNDS_RELEASED',
          }),
        })
      );
    });
  });

  describe('refundEscrow & disputeEscrow', () => {
    it('refunds escrow and marks deal cancelled', async () => {
      const escrow = {
        id: 'escrow-1',
        dealId: 'deal-101',
        amount: 3000000,
        status: 'HELD',
        buyerParty: { ownerId: 'owner-1', name: 'Buyer Co', owner: { user: { email: 'buyer@test.com' } } },
        sellerParty: { ownerId: 'owner-2', name: 'Seller Co', owner: { user: { email: 'seller@test.com' } } },
      };

      prisma.escrowTransaction.findUnique.mockResolvedValue(escrow);
      prisma.escrowTransaction.update.mockResolvedValue({
        ...escrow,
        status: 'REFUNDED',
        refundedAt: new Date(),
      });
      prisma.deal.update.mockResolvedValue({ id: 'deal-101', status: 'CANCELLED' });

      const result = await escrowService.refundEscrow({
        escrowId: 'escrow-1',
        callerProfileId: 'owner-2',
        reason: 'Stok barang mendadak habis',
      });

      expect(result.status).toBe('REFUNDED');
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-101' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      );
    });

    it('flags escrow as DISPUTED with dispute reason', async () => {
      const escrow = {
        id: 'escrow-1',
        status: 'HELD',
        buyerParty: { ownerId: 'owner-1' },
        sellerParty: { ownerId: 'owner-2' },
      };

      prisma.escrowTransaction.findUnique.mockResolvedValue(escrow);
      prisma.escrowTransaction.update.mockResolvedValue({
        ...escrow,
        status: 'DISPUTED',
        disputeReason: 'Barang cacat tidak sesuai deskripsi',
      });

      const result = await escrowService.disputeEscrow({
        escrowId: 'escrow-1',
        callerProfileId: 'owner-1',
        disputeReason: 'Barang cacat tidak sesuai deskripsi',
      });

      expect(result.status).toBe('DISPUTED');
    });
  });
});
