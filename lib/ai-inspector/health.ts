import type { TraceStep } from "@/lib/observability";
import { stepConfidence, stepLatencyMs, stepSeverity } from "@/lib/ai-inspector/step-meta";

export type ConversationHealthSummary = {
  totalSteps: number;
  /** Mean of every nlu_extraction/decision step's confidence score, or null when the conversation has neither. */
  avgConfidence: number | null;
  /** Sum of every timed engine call's latency_ms -- total AI processing time, not wall-clock conversation duration. */
  totalLatencyMs: number;
  errorCount: number;
  warningCount: number;
  /** The most recently detected NLU language ("ar" | "fr" | "en" | "other"), or null if no message was ever parsed. */
  language: string | null;
  /** endedAt - startedAt in ms, or null while the conversation is still open. */
  durationMs: number | null;
};

/**
 * Pure rollup over an already-fetched ConversationTrace's steps -- no
 * I/O, no new data beyond what lib/observability/trace/engine.ts
 * already returned. Powers the inspector's health-summary strip.
 */
export function computeConversationHealth(
  steps: TraceStep[],
  conversation: { startedAt: string; endedAt: string | null },
): ConversationHealthSummary {
  let confidenceSum = 0;
  let confidenceCount = 0;
  let totalLatencyMs = 0;
  let errorCount = 0;
  let warningCount = 0;
  let language: string | null = null;

  for (const step of steps) {
    const confidence = stepConfidence(step);
    if (confidence !== null) {
      confidenceSum += confidence;
      confidenceCount += 1;
    }

    const latency = stepLatencyMs(step);
    if (latency !== null) totalLatencyMs += latency;

    const severity = stepSeverity(step);
    if (severity === "error") errorCount += 1;
    else if (severity === "warning") warningCount += 1;

    if (step.type === "nlu_extraction" && typeof step.data.language === "string") {
      language = step.data.language;
    }
  }

  return {
    totalSteps: steps.length,
    avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
    totalLatencyMs,
    errorCount,
    warningCount,
    language,
    durationMs: conversation.endedAt
      ? new Date(conversation.endedAt).getTime() - new Date(conversation.startedAt).getTime()
      : null,
  };
}
