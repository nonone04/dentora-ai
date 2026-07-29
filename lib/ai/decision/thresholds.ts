/**
 * Centralized confidence thresholds for the Decision Engine -- the single
 * source of truth so router.ts (and every test of it) never hardcodes a
 * magic number inline. Each threshold gates a specific deterministic
 * shortcut: below it, the router defers to the full tool-selection model
 * instead of trusting a possibly-shaky NLU extraction on its own.
 *
 * Emergency detection deliberately has no threshold here -- see
 * lib/ai/decision/emergency.ts. A missed dental emergency is far more
 * costly than an unnecessary staff ping, so it always wins regardless of
 * how confident the extraction was.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Trust the extraction enough to short-circuit with a follow-up question instead of the LLM tool loop. */
  followUp: 0.35,
  /** Trust an escalate_to_staff intent enough to escalate deterministically, without LLM judgment. */
  escalation: 0.45,
  /** Trust a greeting intent enough to answer directly, without invoking a tool or the LLM at all. */
  greeting: 0.45,
} as const;
