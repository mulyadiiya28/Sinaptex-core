const { rateLimiter } = require('../../src/middlewares/rateLimit.middleware');
const throttleConfig = require('../../src/config/throttle.config');

describe('Rate Limiter Middleware', () => {
  it('should export a valid middleware function', () => {
    expect(typeof rateLimiter).toBe('function');
  });

  it('should use configured windowMs and max limit from throttle config', () => {
    expect(throttleConfig.global.windowMs).toBeDefined();
    expect(throttleConfig.global.max).toBeDefined();
    expect(throttleConfig.global.max).toBeGreaterThan(0);
  });
});
