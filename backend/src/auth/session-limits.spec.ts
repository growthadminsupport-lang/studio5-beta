import { SESSION_LIMITS, sessionExpiry } from './session-limits';

describe('sessionExpiry', () => {
  const now = Date.UTC(2026, 9, 8, 9, 0, 0);

  it('starts a new session with its idle and absolute limits', () => {
    const short = sessionExpiry({ persistent: false }, now);
    expect(short.expiresAt.getTime()).toBe(now + SESSION_LIMITS.browser.idleMs);
    expect(short.absoluteExpiresAt.getTime()).toBe(
      now + SESSION_LIMITS.browser.absoluteMs,
    );
    const long = sessionExpiry({ persistent: true }, now);
    expect(long.expiresAt.getTime()).toBe(
      now + SESSION_LIMITS.remembered.idleMs,
    );
    expect(long.absoluteExpiresAt.getTime()).toBe(
      now + SESSION_LIMITS.remembered.absoluteMs,
    );
  });

  it('keeps a renewed session inside its absolute end', () => {
    const end = new Date(now + 10 * 60 * 1000); // 10 minutes left
    const renewed = sessionExpiry(
      { persistent: false, absoluteExpiresAt: end },
      now,
    );
    expect(renewed.absoluteExpiresAt).toBe(end);
    expect(renewed.expiresAt.getTime()).toBe(end.getTime());
  });
});
