const crypto = require('crypto');
const {
  ALLOWED_DOCUMENT_TYPES,
  computeFileHash,
  attachDocumentToOpportunity,
  listOpportunityDocuments,
  removeOpportunityDocument,
} = require('../../src/modules/opportunity/opportunityDocument.service');
const prisma = require('../../src/config/prisma');
const cloudinaryUpload = require('../../src/utils/cloudinaryUpload');

jest.mock('../../src/config/prisma', () => ({
  opportunity: {
    findUnique: jest.fn(),
  },
  media: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/utils/cloudinaryUpload', () => ({
  uploadBuffer: jest.fn(),
  deleteAsset: jest.fn(),
}));

describe('Opportunity Document & Proof Upload Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeFileHash', () => {
    it('computes correct sha256 hex string for buffer', () => {
      const buffer = Buffer.from('test-file-content');
      const expected = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(computeFileHash(buffer)).toBe(expected);
    });
  });

  describe('ALLOWED_DOCUMENT_TYPES', () => {
    it('includes essential trade verification document types', () => {
      expect(ALLOWED_DOCUMENT_TYPES).toContain('PROOF_OF_TRADE');
      expect(ALLOWED_DOCUMENT_TYPES).toContain('QUALITY_CERTIFICATE');
      expect(ALLOWED_DOCUMENT_TYPES).toContain('INVOICE');
      expect(ALLOWED_DOCUMENT_TYPES).toContain('SPECIFICATION');
    });
  });

  describe('attachDocumentToOpportunity', () => {
    const mockFile = {
      buffer: Buffer.from('mock-document-bytes'),
      mimetype: 'application/pdf',
      originalname: 'invoice-2026.pdf',
    };

    it('throws bad request error when file buffer is missing', async () => {
      await expect(
        attachDocumentToOpportunity({
          opportunityId: 'opp-1',
          profileId: 'profile-1',
          file: null,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'File buffer is required for upload',
      });
    });

    it('throws not found error when opportunity does not exist', async () => {
      prisma.opportunity.findUnique.mockResolvedValue(null);

      await expect(
        attachDocumentToOpportunity({
          opportunityId: 'opp-non-existent',
          profileId: 'profile-1',
          file: mockFile,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Opportunity not found',
      });
    });

    it('throws forbidden error when profile does not own the opportunity party', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        type: 'OFFER',
        party: { ownerId: 'other-owner' },
      });

      await expect(
        attachDocumentToOpportunity({
          opportunityId: 'opp-1',
          profileId: 'profile-1',
          file: mockFile,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('successfully uploads PDF and creates media record', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        type: 'OFFER',
        party: { ownerId: 'profile-1' },
      });

      cloudinaryUpload.uploadBuffer.mockResolvedValue({
        url: 'https://res.cloudinary.com/demo/raw/upload/proof.pdf',
        cloudinaryId: 'sinaptex/opportunities/offer/opp-1/proofs/doc123',
        format: 'pdf',
      });

      prisma.media.create.mockResolvedValue({
        id: 'media-1',
        ownerType: 'OPPORTUNITY',
        opportunityId: 'opp-1',
        url: 'https://res.cloudinary.com/demo/raw/upload/proof.pdf',
        cloudinaryId: 'sinaptex/opportunities/offer/opp-1/proofs/doc123',
        format: 'pdf',
      });

      const result = await attachDocumentToOpportunity({
        opportunityId: 'opp-1',
        profileId: 'profile-1',
        file: mockFile,
        documentType: 'PROOF_OF_TRADE',
        title: 'Supplier Invoice',
      });

      expect(cloudinaryUpload.uploadBuffer).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.objectContaining({
          folder: 'sinaptex/opportunities/offer/opp-1/proofs',
          resourceType: 'raw',
        })
      );

      expect(prisma.media.create).toHaveBeenCalledWith({
        data: {
          ownerType: 'OPPORTUNITY',
          opportunityId: 'opp-1',
          url: 'https://res.cloudinary.com/demo/raw/upload/proof.pdf',
          cloudinaryId: 'sinaptex/opportunities/offer/opp-1/proofs/doc123',
          format: 'pdf',
        },
      });

      expect(result).toMatchObject({
        id: 'media-1',
        documentType: 'PROOF_OF_TRADE',
        title: 'Supplier Invoice',
        opportunityType: 'OFFER',
      });
      expect(result.fileHash).toBeDefined();
    });

    it('uploads image with resourceType image for NEED opportunity', async () => {
      const imgFile = {
        buffer: Buffer.from('image-bytes'),
        mimetype: 'image/png',
        originalname: 'sample.png',
      };

      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-2',
        type: 'NEED',
        party: { ownerId: 'profile-1' },
      });

      cloudinaryUpload.uploadBuffer.mockResolvedValue({
        url: 'https://res.cloudinary.com/demo/image/upload/sample.png',
        cloudinaryId: 'sinaptex/opportunities/need/opp-2/proofs/img123',
        format: 'png',
      });

      prisma.media.create.mockResolvedValue({
        id: 'media-2',
        ownerType: 'OPPORTUNITY',
        opportunityId: 'opp-2',
        url: 'https://res.cloudinary.com/demo/image/upload/sample.png',
        cloudinaryId: 'sinaptex/opportunities/need/opp-2/proofs/img123',
        format: 'png',
      });

      const result = await attachDocumentToOpportunity({
        opportunityId: 'opp-2',
        profileId: 'profile-1',
        file: imgFile,
        documentType: 'SAMPLE_IMAGE',
      });

      expect(cloudinaryUpload.uploadBuffer).toHaveBeenCalledWith(
        imgFile.buffer,
        expect.objectContaining({
          folder: 'sinaptex/opportunities/need/opp-2/proofs',
          resourceType: 'image',
        })
      );
      expect(result.title).toBe('sample.png');
    });
  });

  describe('listOpportunityDocuments', () => {
    it('throws not found when opportunity does not exist', async () => {
      prisma.opportunity.findUnique.mockResolvedValue(null);
      await expect(listOpportunityDocuments('opp-none')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('returns media items attached to the opportunity', async () => {
      const mockMedia = [
        { id: 'm-1', url: 'https://cloud/1.pdf' },
        { id: 'm-2', url: 'https://cloud/2.png' },
      ];
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        media: mockMedia,
      });

      const result = await listOpportunityDocuments('opp-1');
      expect(result).toEqual(mockMedia);
    });
  });

  describe('removeOpportunityDocument', () => {
    it('throws not found if opportunity does not exist', async () => {
      prisma.opportunity.findUnique.mockResolvedValue(null);
      await expect(
        removeOpportunityDocument({
          opportunityId: 'opp-none',
          mediaId: 'm-1',
          profileId: 'p-1',
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('throws forbidden if profile is not the opportunity party owner', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        party: { ownerId: 'other-owner' },
      });
      await expect(
        removeOpportunityDocument({
          opportunityId: 'opp-1',
          mediaId: 'm-1',
          profileId: 'p-1',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('throws not found if media is not on this opportunity', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        party: { ownerId: 'p-1' },
      });
      prisma.media.findFirst.mockResolvedValue(null);

      await expect(
        removeOpportunityDocument({
          opportunityId: 'opp-1',
          mediaId: 'm-missing',
          profileId: 'p-1',
        })
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('deletes from cloudinary and database successfully', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        party: { ownerId: 'p-1' },
      });
      prisma.media.findFirst.mockResolvedValue({
        id: 'm-1',
        cloudinaryId: 'cloud-id-1',
        format: 'pdf',
      });
      cloudinaryUpload.deleteAsset.mockResolvedValue({ result: 'ok' });
      prisma.media.delete.mockResolvedValue({ id: 'm-1' });

      const result = await removeOpportunityDocument({
        opportunityId: 'opp-1',
        mediaId: 'm-1',
        profileId: 'p-1',
      });

      expect(cloudinaryUpload.deleteAsset).toHaveBeenCalledWith('cloud-id-1', 'raw');
      expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } });
      expect(result).toEqual({ deleted: true, mediaId: 'm-1' });
    });
  });
});
