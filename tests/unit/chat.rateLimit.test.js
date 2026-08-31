/**
 * Unit tests untuk helper murni chat.rateLimit (tanpa Redis/Prisma).
 * Assert rate-limit penuh butuh integration test + mock.
 */
const {
  jakartaDayKey,
  startOfJakartaDay,
  newConversationRedisKey,
} = require('../../src/modules/chat/chat.rateLimit');

describe('chat.rateLimit helpers', () => {
  test('jakartaDayKey returns YYYY-MM-DD', () => {
    const key = jakartaDayKey(new Date('2026-09-01T10:00:00+07:00'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key).toBe('2026-09-01');
  });

  test('jakartaDayKey shifts correctly around UTC midnight', () => {
    // 2026-08-31 20:00 UTC = 2026-09-01 03:00 WIB
    const key = jakartaDayKey(new Date('2026-08-31T20:00:00.000Z'));
    expect(key).toBe('2026-09-01');
  });

  test('startOfJakartaDay is midnight WIB', () => {
    const start = startOfJakartaDay(new Date('2026-09-01T15:00:00+07:00'));
    expect(start.toISOString()).toBe(new Date('2026-09-01T00:00:00+07:00').toISOString());
  });

  test('newConversationRedisKey format', () => {
    const key = newConversationRedisKey('profile-abc', '2026-09-01');
    expect(key).toBe('rl:chat:conv:profile-abc:2026-09-01');
  });
});
