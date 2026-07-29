/**
 * Centralized health-check thresholds -- same rationale as
 * lib/ai/decision/thresholds.ts: every "is this bad enough to flag"
 * judgment call lives here, not scattered across checks.ts, so a
 * threshold can be tuned in one place.
 */

export const AI_ERROR_RATE_DEGRADED = 0.1;
export const AI_ERROR_RATE_UNHEALTHY = 0.25;

export const ESCALATION_RATE_DEGRADED = 0.35;
export const ESCALATION_RATE_UNHEALTHY = 0.6;

export const NOTIFICATION_FAILURE_RATE_DEGRADED = 0.1;
export const NOTIFICATION_FAILURE_RATE_UNHEALTHY = 0.3;

export const KNOWLEDGE_MISS_RATE_DEGRADED = 0.4;
export const KNOWLEDGE_MISS_RATE_UNHEALTHY = 0.7;

/** Below this many samples in the window, a rate is too noisy to judge -- report healthy rather than flagging on a fluke. */
export const MIN_SAMPLE_SIZE = 5;
