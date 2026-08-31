const cors = require('cors');
const {
  getAllowedOrigins,
  isOriginAllowed,
  corsOptions,
  DEFAULT_PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
} = require('../../src/config/cors.config');

describe('CORS Whitelist Configuration & Middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getAllowedOrigins', () => {
    it('returns default development and production origins when in test/dev mode', () => {
      delete process.env.ALLOWED_ORIGINS;
      delete process.env.CLIENT_URL;
      process.env.NODE_ENV = 'development';

      const origins = getAllowedOrigins();
      expect(origins).toEqual(
        expect.arrayContaining([...DEFAULT_PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS])
      );
      expect(origins).toContain('https://sinaptex.com');
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:5173');
    });

    it('returns only production origins when in production mode without extras', () => {
      delete process.env.ALLOWED_ORIGINS;
      delete process.env.CLIENT_URL;
      process.env.NODE_ENV = 'production';

      const origins = getAllowedOrigins();
      expect(origins).toEqual(DEFAULT_PRODUCTION_ORIGINS);
      expect(origins).not.toContain('http://localhost:3000');
    });

    it('parses comma-separated origins from ALLOWED_ORIGINS and CLIENT_URL', () => {
      process.env.ALLOWED_ORIGINS = 'https://partner.sinaptex.com, https://portal.sinaptex.com ';
      process.env.CLIENT_URL = 'https://custom-frontend.com';
      process.env.NODE_ENV = 'production';

      const origins = getAllowedOrigins();
      expect(origins).toContain('https://partner.sinaptex.com');
      expect(origins).toContain('https://portal.sinaptex.com');
      expect(origins).toContain('https://custom-frontend.com');
      expect(origins).toContain('https://sinaptex.com');
    });
  });

  describe('isOriginAllowed', () => {
    it('allows requests without an Origin header (server-to-server / curl)', () => {
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed(null)).toBe(true);
      expect(isOriginAllowed('')).toBe(true);
    });

    it('allows production authorized frontend domains', () => {
      expect(isOriginAllowed('https://sinaptex.com')).toBe(true);
      expect(isOriginAllowed('https://app.sinaptex.com')).toBe(true);
      expect(isOriginAllowed('https://admin.sinaptex.com')).toBe(true);
    });

    it('handles case-insensitivity', () => {
      expect(isOriginAllowed('HTTPS://SINAPTEX.COM')).toBe(true);
      expect(isOriginAllowed('https://APP.sinaptex.COM ')).toBe(true);
    });

    it('rejects unauthorized third-party origins', () => {
      const customWhitelist = ['https://sinaptex.com', 'https://app.sinaptex.com'];
      expect(isOriginAllowed('https://evil-site.com', customWhitelist)).toBe(false);
      expect(isOriginAllowed('http://malicious.org', customWhitelist)).toBe(false);
      expect(isOriginAllowed('https://not-sinaptex.com', customWhitelist)).toBe(false);
    });

    it('supports wildcard subdomain patterns', () => {
      const customWhitelist = ['*.sinaptex.com', 'https://example.com'];
      expect(isOriginAllowed('https://staging.sinaptex.com', customWhitelist)).toBe(true);
      expect(isOriginAllowed('https://api.v2.sinaptex.com', customWhitelist)).toBe(true);
      expect(isOriginAllowed('https://otherdomain.com', customWhitelist)).toBe(false);
    });
  });

  describe('corsOptions origin callback', () => {
    it('calls callback with null and true for authorized origin', (done) => {
      corsOptions.origin('https://sinaptex.com', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('calls callback with ApiError for unauthorized origin', (done) => {
      corsOptions.origin('https://unauthorized-origin.com', (err, allow) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
        expect(allow).toBeUndefined();
        done();
      });
    });
  });

  describe('CORS middleware execution', () => {
    const corsMiddleware = cors(corsOptions);

    it('sets CORS response headers for authorized origin', (done) => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'https://sinaptex.com',
        },
      };
      const headers = {};
      const res = {
        setHeader: (key, val) => {
          headers[key.toLowerCase()] = val;
        },
        getHeader: (key) => headers[key.toLowerCase()],
      };

      corsMiddleware(req, res, (err) => {
        expect(err).toBeUndefined();
        expect(headers['access-control-allow-origin']).toBe('https://sinaptex.com');
        expect(headers['access-control-allow-credentials']).toBe('true');
        done();
      });
    });

    it('passes error to next middleware when origin is unauthorized', (done) => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'https://attack-vector.xyz',
        },
      };
      const res = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      };

      corsMiddleware(req, res, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
        done();
      });
    });

    it('handles preflight OPTIONS request with allowed methods and headers', (done) => {
      const req = {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.sinaptex.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, Authorization',
        },
      };
      const headers = {};
      const res = {
        statusCode: 200,
        setHeader: (key, val) => {
          headers[key.toLowerCase()] = val;
        },
        getHeader: (key) => headers[key.toLowerCase()],
        end: () => {
          expect(headers['access-control-allow-origin']).toBe('https://app.sinaptex.com');
          expect(headers['access-control-allow-methods']).toContain('POST');
          done();
        },
      };

      corsMiddleware(req, res, (err) => {
        if (!err) {
          expect(headers['access-control-allow-origin']).toBe('https://app.sinaptex.com');
          done();
        }
      });
    });
  });
});
