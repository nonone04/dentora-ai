import type { NLUExtraction } from "@/lib/ai/nlu/types";

/**
 * Deterministic, defense-in-depth re-check of the raw message text --
 * deliberately independent of which NLU client produced the extraction.
 * The rule-based extractor's own urgency heuristic (lib/ai/nlu/
 * rule-based-client.ts) already sets urgency: "emergency" for most of
 * these phrases, and the real model is asked to do the same (lib/ai/nlu/
 * prompt.ts) -- but the Decision Engine is the safety backstop, so it
 * never trusts urgency alone. Intentionally over-inclusive: a false
 * positive here just pings staff unnecessarily, a false negative could
 * leave a genuine emergency unanswered.
 */
const EMERGENCY_PATTERNS: RegExp[] = [
  /\bemergency\b/i,
  /\burgence\b/i,
  /\bcan'?t stop bleeding\b/i,
  /\bcannot stop bleeding\b/i,
  /\bne s'arrête pas de saigner\b/i,
  /\bknocked out\b/i,
  /\btooth (?:got |was )?knocked out\b/i,
  /\bswollen face\b/i,
  /\bface is swelling\b/i,
  // No trailing \b here -- \b is defined over ASCII word chars only, and
  // the accented "é" this phrase ends on would never satisfy it.
  /\bvisage (?:est )?enfl[ée]/i,
  /\bsevere pain\b/i,
  /\bunbearable\b/i,
  /\bdouleur insupportable\b/i,
  /\bcan'?t breathe\b/i,
  /\btrouble breathing\b/i,
];

/**
 * True if this turn should be treated as a dental emergency -- either
 * because the NLU extraction already classified it that way, or because
 * the raw message independently matches one of the patterns above.
 * Always wins in the router regardless of confidence -- see
 * lib/ai/decision/router.ts.
 */
export function isEmergency(nlu: NLUExtraction): boolean {
  if (nlu.urgency === "emergency") return true;
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(nlu.rawMessage));
}
