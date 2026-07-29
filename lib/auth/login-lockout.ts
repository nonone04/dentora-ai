/**
 * Per-account failed-login lockout. Deliberately separate from
 * lib/ai/rate-limit.ts's checkRateLimit: that utility counts every call as
 * a consumed attempt (right for a generic "N requests per window" throttle),
 * but a failed-login lockout needs to *check* whether an account is already
 * over the limit without that check itself counting as a failure -- a
 * correct password on attempt 1 must not be penalized by having "used up"
 * a slot just by being checked. Same in-memory, single-process, per-process
 * scope/tradeoff as checkRateLimit (see that file's comment).
 */
const failures = new Map<string, number[]>();

function recentFailures(key: string, windowMs: number): number[] {
  const windowStart = Date.now() - windowMs;
  const recent = (failures.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
  failures.set(key, recent);
  return recent;
}

export function isAccountLocked(key: string, limit: number, windowMs: number): boolean {
  return recentFailures(key, windowMs).length >= limit;
}

export function recordLoginFailure(key: string, windowMs: number): void {
  const recent = recentFailures(key, windowMs);
  recent.push(Date.now());
  failures.set(key, recent);
}
