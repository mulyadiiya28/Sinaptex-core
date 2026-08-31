const fs = require('fs');
const path = require('path');
const logger = require('../../src/core/logger');
const loggerConfig = require('../../src/config/logger.config');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    appendFile: jest.fn((file, data, cb) => {
      if (typeof cb === 'function') cb(null);
    }),
  };
});

describe('Structured Core Logger', () => {
  let stderrSpy;
  let stdoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('logs error level to stderr with timestamp and appends to error.log and combined.log', () => {
    logger.error('Database query timed out', {
      query: 'SELECT * FROM users',
      stack: 'Error: timeout\n at query',
    });

    expect(stderrSpy).toHaveBeenCalled();
    const loggedRaw = stderrSpy.mock.calls[0][0];
    const logged = JSON.parse(loggedRaw);

    expect(logged.level).toBe('error');
    expect(logged.message).toBe('Database query timed out');
    expect(logged.timestamp).toBeDefined();
    expect(logged.meta.query).toBe('SELECT * FROM users');

    const expectedErrorLog = path.join(loggerConfig.logDir, loggerConfig.errorLogFile);
    const expectedCombinedLog = path.join(loggerConfig.logDir, loggerConfig.combinedLogFile);

    expect(fs.appendFile).toHaveBeenCalledWith(
      expectedErrorLog,
      expect.stringContaining('Database query timed out'),
      expect.any(Function)
    );
    expect(fs.appendFile).toHaveBeenCalledWith(
      expectedCombinedLog,
      expect.stringContaining('Database query timed out'),
      expect.any(Function)
    );
  });

  it('logs info level to stdout and appends to combined.log only', () => {
    logger.info('User logged in', { userId: 'usr-123' });

    expect(stdoutSpy).toHaveBeenCalled();
    const loggedRaw = stdoutSpy.mock.calls[0][0];
    const logged = JSON.parse(loggedRaw);

    expect(logged.level).toBe('info');
    expect(logged.message).toBe('User logged in');
    expect(logged.meta.userId).toBe('usr-123');

    const expectedErrorLog = path.join(loggerConfig.logDir, loggerConfig.errorLogFile);
    expect(fs.appendFile).not.toHaveBeenCalledWith(
      expectedErrorLog,
      expect.anything(),
      expect.anything()
    );
  });

  it('redacts sensitive fields in nested metadata', () => {
    logger.warn('Failed payment attempt', {
      account: {
        userId: 'usr-456',
        password: 'cleartext-password',
        token: 'secret-token-123',
        creditCard: '4111-2222-3333-4444',
      },
    });

    expect(stdoutSpy).toHaveBeenCalled();
    const logged = JSON.parse(stdoutSpy.mock.calls[0][0]);

    expect(logged.meta.account.userId).toBe('usr-456');
    expect(logged.meta.account.password).toBe('[REDACTED]');
    expect(logged.meta.account.token).toBe('[REDACTED]');
    expect(logged.meta.account.creditCard).toBe('[REDACTED]');
  });

  it('safely serializes circular references and error objects without throwing', () => {
    const circularObj = { name: 'cyclic' };
    circularObj.self = circularObj;
    circularObj.err = new Error('nested error');

    expect(() => {
      logger.error('Circular object error', { data: circularObj });
    }).not.toThrow();

    expect(stderrSpy).toHaveBeenCalled();
    const logged = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(logged.meta.data.self).toBe('[Circular]');
    expect(logged.meta.data.err.message).toBe('nested error');
  });
});
