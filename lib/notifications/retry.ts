export const DEFAULT_MAX_ATTEMPTS = 5;

const BASE_DELAY_MINUTES = 5;
const MAX_DELAY_MINUTES = 24 * 60;

/** Exponential backoff (5, 10, 20, 40, 80, ... minutes), capped at 24h. Pure -- attempt is 1-indexed (the attempt number that just failed). */
export function computeBackoffMinutes(attempt: number): number {
  const delay = BASE_DELAY_MINUTES * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, MAX_DELAY_MINUTES);
}

export function computeNextAttemptAt(attempt: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + computeBackoffMinutes(attempt) * 60_000);
}

/** Whether another attempt is still allowed after `attempts` failures so far. */
export function shouldRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}
