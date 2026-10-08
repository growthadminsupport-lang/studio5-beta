/**
 * How long a sign-in lasts. Every session has two limits:
 * - idle: the refresh token expires this long after it was issued, and each refresh issues a
 *   new one, so an app in use stays signed in and one left alone signs out;
 * - absolute: from the moment of signing in, however active. Refreshes carry it over, so a
 *   session can never be kept alive forever.
 *
 * "Remember me" (and creating an account) keeps the session across browser restarts; without
 * it the refresh token lives in sessionStorage and the limits are short, for a shared family
 * computer. Children's growth records and X-rays are health data (PDPA section 26).
 *
 * The idle limit is measured from the last refresh, which happens about every 15 minutes
 * (JWT_ACCESS_EXPIRES_IN) while the app makes requests. The browser signs a short session out
 * after 30 minutes without input (AuthContext); the server's hour is the backstop for a tab
 * that was closed or asleep.
 */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SESSION_LIMITS = {
  remembered: { idleMs: 7 * DAY, absoluteMs: 30 * DAY },
  browser: { idleMs: HOUR, absoluteMs: 12 * HOUR },
} as const;

export interface SessionTerms {
  /** "Remember me": the long limits. */
  persistent: boolean;
  /** Set when an existing session is renewed; a new sign-in starts its own. */
  absoluteExpiresAt?: Date;
}

/** When a token issued now expires, and when the session it belongs to ends. */
export function sessionExpiry(terms: SessionTerms, now = Date.now()) {
  const limits = terms.persistent
    ? SESSION_LIMITS.remembered
    : SESSION_LIMITS.browser;
  const absoluteExpiresAt =
    terms.absoluteExpiresAt ?? new Date(now + limits.absoluteMs);
  const idle = now + limits.idleMs;
  const expiresAt = new Date(Math.min(idle, absoluteExpiresAt.getTime()));
  return { expiresAt, absoluteExpiresAt };
}
