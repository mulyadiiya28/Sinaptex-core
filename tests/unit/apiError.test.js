const ApiError = require('../../src/utils/apiError');
const ErrorCodes = require('../../src/utils/errorCodes');

describe('ApiError', () => {
  it.each([
    ['badRequest', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['notFound', 404],
    ['conflict', 409],
    ['internal', 500],
  ])('%s() produces statusCode %i', (method, expectedStatus) => {
    const err = ApiError[method]('test message');
    expect(err.statusCode).toBe(expectedStatus);
    expect(err.message).toBe('test message');
    expect(err.isOperational).toBe(true);
  });

  it('carries optional details payload', () => {
    const err = ApiError.badRequest('validation failed', [{ path: 'title', message: 'required' }]);
    expect(err.details).toEqual([{ path: 'title', message: 'required' }]);
  });

  it('is an instance of Error', () => {
    expect(ApiError.notFound()).toBeInstanceOf(Error);
  });

  describe('code field', () => {
    it.each([
      ['badRequest', ErrorCodes.VALIDATION_ERROR],
      ['unauthorized', ErrorCodes.UNAUTHORIZED],
      ['forbidden', ErrorCodes.FORBIDDEN],
      ['notFound', ErrorCodes.NOT_FOUND],
      ['conflict', ErrorCodes.CONFLICT],
      ['internal', ErrorCodes.INTERNAL_ERROR],
    ])('%s() defaults to code %s when no explicit code given', (method, expectedCode) => {
      const err = ApiError[method]('msg');
      expect(err.code).toBe(expectedCode);
    });

    it('paymentRequired() produces statusCode 402 with default code PAYMENT_REQUIRED', () => {
      const err = ApiError.paymentRequired('need to pay');
      expect(err.statusCode).toBe(402);
      expect(err.code).toBe(ErrorCodes.PAYMENT_REQUIRED);
    });

    it('accepts an explicit domain-specific code, overriding the default', () => {
      const err = ApiError.forbidden('membership required', ErrorCodes.MEMBERSHIP_REQUIRED);
      expect(err.code).toBe('MEMBERSHIP_REQUIRED');
    });

    it('conflict() still accepts details as 2nd arg and code as 3rd', () => {
      const err = ApiError.conflict('blocked', { riskScore: 100 }, ErrorCodes.FRAUD_DETECTED);
      expect(err.details).toEqual({ riskScore: 100 });
      expect(err.code).toBe('FRAUD_DETECTED');
    });
  });
});
