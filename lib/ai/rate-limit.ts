/**
 * Minimal in-memory sliding-window limiter for the public patient chat
 * endpoint. A public, unauthenticated route that triggers a paid LLM
 * call per request needs *some* abuse backstop even before real infra
 * exists -- mirrors how other phases picked the simplest thing that
 * works over adding new infra (e.g. lib/notifications/provider.ts's
 * logging default).
 *
 * Scope boundary: per-process only, resets on deploy/restart, and
 * doesn't coordinate across multiple server instances. Fine for a
 * single-instance deployment; would need a shared store (e.g. Redis)
 * to hold under real multi-instance load.
 */
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}
