import type { ReliabilityLabel, ReliabilityScore } from "@/lib/ai/patient/types";

/** Only the three settled appointment outcomes count toward reliability -- scheduled/confirmed appointments haven't happened yet and don't affect the score either way. */
export type AppointmentOutcome = "completed" | "no_show" | "cancelled";

/** Below this many settled appointments, a score is statistically meaningless -- the label says so explicitly rather than implying confidence the data doesn't support. */
const MIN_SAMPLE_SIZE = 3;

/** A cancellation (the patient told someone) is treated as materially better than silently not showing up, but still not as good as actually completing the visit. */
const CANCELLED_CREDIT = 0.5;

function labelFor(score: number, sampleSize: number): ReliabilityLabel {
  if (sampleSize < MIN_SAMPLE_SIZE) return "insufficient_data";
  if (score >= 0.85) return "excellent";
  if (score >= 0.65) return "good";
  if (score >= 0.4) return "fair";
  return "poor";
}

/**
 * Deterministic reliability score from a patient's settled appointment
 * outcomes -- no ML, no LLM, just arithmetic: completed appointments
 * count fully, cancellations count at half credit, no-shows count for
 * nothing. Pure -- lib/ai/patient/store.ts is the only caller that
 * fetches the outcomes this needs.
 */
export function computeReliabilityScore(outcomes: AppointmentOutcome[]): ReliabilityScore {
  const completedCount = outcomes.filter((outcome) => outcome === "completed").length;
  const noShowCount = outcomes.filter((outcome) => outcome === "no_show").length;
  const cancelledCount = outcomes.filter((outcome) => outcome === "cancelled").length;
  const sampleSize = outcomes.length;

  const rawScore = sampleSize === 0 ? 0 : (completedCount + cancelledCount * CANCELLED_CREDIT) / sampleSize;
  const score = Math.min(1, Math.max(0, rawScore));

  return {
    score,
    label: labelFor(score, sampleSize),
    completedCount,
    noShowCount,
    cancelledCount,
    sampleSize,
  };
}
