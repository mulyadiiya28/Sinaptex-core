const {
  isSessionVerified,
  requireVerifiedSession,
  protectStateChanges,
  STATE_MUTATION_METHODS,
} = require('../../src/middlewares/verifiedSession.middleware');
const { supabaseAdmin } = require('../../src/config/supabase');
const prisma = require('../../src/config/prisma');
const ErrorCodes = require('../../src/utils/errorCodes');

jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('../../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('Verified Session Middleware & Policy (Escrow & Membership Protection)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isSessionVerified', () => {
    it('returns false when supabase user is missing', () => {
      const result = isSessionVerified(null);
      expect(result.isVerified).toBe(false);
      expect(result.reason).toContain('No active session');
    });

    it('returns false when email and phone are not confirmed', () => {
      const user = { id: 'usr-1', email: 'user@example.com' };
      const result = isSessionVerified(user);
      expect(result.isVerified).toBe(false);
      expect(result.reason).toContain('Email or phone must be verified');
    });

    it('returns true when email is confirmed via email_confirmed_at', () => {
      const user = {
        id: 'usr-1',
        email: 'user@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      };
      const result = isSessionVerified(user);
      expect(result.isVerified).toBe(true);
    });

    it('returns true when phone is confirmed via phone_confirmed_at', () => {
      const user = {
        id: 'usr-1',
        phone: '+62812345678',
        phone_confirmed_at: '2026-01-01T00:00:00Z',
      };
      const result = isSessionVerified(user);
      expect(result.isVerified).toBe(true);
    });

    it('returns true for OAuth third-party confirmed sessions', () => {
      const user = {
        id: 'usr-1',
        app_metadata: { provider: 'google' },
      };
      const result = isSessionVerified(user);
      expect(result.isVerified).toBe(true);
    });

    it('returns false with ACCOUNT_SUSPENDED when profile is suspended', () => {
      const user = { id: 'usr-1', email_confirmed_at: '2026-01-01' };
      const profile = { accountStatus: 'SUSPENDED', suspendedReason: 'Under review' };
      const result = isSessionVerified(user, profile);
      expect(result.isVerified).toBe(false);
      expect(result.code).toBe(ErrorCodes.ACCOUNT_SUSPENDED);
    });

    it('returns false with ACCOUNT_BANNED when profile is banned', () => {
      const user = { id: 'usr-1', email_confirmed_at: '2026-01-01' };
      const profile = { accountStatus: 'BANNED' };
      const result = isSessionVerified(user, profile);
      expect(result.isVerified).toBe(false);
      expect(result.code).toBe(ErrorCodes.ACCOUNT_BANNED);
    });
  });

  describe('requireVerifiedSession middleware execution', () => {
    const middleware = requireVerifiedSession();

    it('passes 401 UNAUTHORIZED to next() when Authorization header is missing', async () => {
      const req = { method: 'POST', headers: {} };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.UNAUTHORIZED,
        })
      );
    });

    it('passes 401 SESSION_INVALID to next() when Supabase token verification fails', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer invalid-expired-token' },
      };
      const res = {};
      const next = jest.fn();

      supabaseAdmin.auth.getUser.mockResolvedValueOnce({
        data: null,
        error: new Error('JWT expired'),
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.SESSION_INVALID,
        })
      );
    });

    it('passes 401 UNAUTHORIZED to next() when local DB user is not found', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = {};
      const next = jest.fn();

      supabaseAdmin.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'sb-1', email_confirmed_at: '2026-01-01' } },
        error: null,
      });
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: ErrorCodes.UNAUTHORIZED,
        })
      );
    });

    it('passes 403 UNVERIFIED_SESSION on state mutations if email/session is unverified', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = {};
      const next = jest.fn();

      supabaseAdmin.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'sb-1', email: 'unverified@test.com' } },
        error: null,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'usr-1',
        supabaseId: 'sb-1',
        profile: { id: 'prof-1', accountStatus: 'ACTIVE' },
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: ErrorCodes.UNVERIFIED_SESSION,
        })
      );
    });

    it('successfully authorizes verified session and attaches user/profile to req', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = {};
      const next = jest.fn();

      const mockSbUser = { id: 'sb-1', email_confirmed_at: '2026-01-01' };
      const mockProfile = { id: 'prof-1', fullName: 'Budi Santoso', accountStatus: 'ACTIVE' };
      const mockUser = { id: 'usr-1', supabaseId: 'sb-1', profile: mockProfile };

      supabaseAdmin.auth.getUser.mockResolvedValueOnce({
        data: { user: mockSbUser },
        error: null,
      });
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.supabaseUser).toEqual(mockSbUser);
      expect(req.user).toEqual(mockUser);
      expect(req.profile).toEqual(mockProfile);
      expect(req.sessionVerified).toBe(true);
    });

    it('handles allowAnonymousReads for GET requests without throwing', async () => {
      const permissiveMiddleware = requireVerifiedSession({ allowAnonymousReads: true });
      const req = { method: 'GET', headers: {} };
      const res = {};
      const next = jest.fn();

      await permissiveMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(supabaseAdmin.auth.getUser).not.toHaveBeenCalled();
    });
  });

  describe('protectStateChanges helper middleware', () => {
    it.each(STATE_MUTATION_METHODS)(
      'enforces verified session for mutating method %s',
      async (method) => {
        const middleware = protectStateChanges();
        const req = { method, headers: {} };
        const res = {};
        const next = jest.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED,
          })
        );
      }
    );

    it('passes unauthenticated GET requests when protectStateChangesOnly is enabled without token', async () => {
      const middleware = protectStateChanges();
      const req = { method: 'GET', headers: {} };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
