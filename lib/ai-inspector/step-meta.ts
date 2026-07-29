import type { TraceStep } from "@/lib/observability";

export type ConfidenceTone = "high" | "medium" | "low";
export type StepSeverity = "error" | "warning" | "normal";

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

export function confidenceTone(confidence: number): ConfidenceTone {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

/** Confidence score for the two step types that carry one (nlu_extraction, decision) -- null for everything else. */
export function stepConfidence(step: TraceStep): number | null {
  if (step.type !== "nlu_extraction" && step.type !== "decision") return null;
  const value = step.data.confidence;
  return typeof value === "number" ? value : null;
}

/** Processing latency for the step types that time an engine call -- null for step types with no timed operation (message, tool_call, lifecycle_event, notification_event). Every latency-bearing raw row uses the same `latency_ms` key (see lib/observability/trace/reconstruct.ts), so one lookup covers all of them. */
export function stepLatencyMs(step: TraceStep): number | null {
  const value = step.data.latency_ms;
  return typeof value === "number" ? value : null;
}

/**
 * Three-tier severity used for the timeline's error visualization:
 * "error" for an outright engine failure, "warning" for a step that
 * succeeded but signals something needing attention (an escalation, an
 * emergency-urgency read, a knowledge search with no hit), "normal"
 * otherwise. Read directly off the same raw fields the underlying
 * engines already log -- no new classification data, just naming what's
 * already there.
 */
export function stepSeverity(step: TraceStep): StepSeverity {
  if (step.type === "turn") {
    if (step.data.outcome === "llm_error") return "error";
    if (step.data.outcome === "tool_calls_exhausted" || step.data.outcome === "escalated") return "warning";
  }
  if (step.type === "decision") {
    if (step.data.decision_kind === "escalate_to_staff" || step.data.decision_kind === "emergency_workflow") return "warning";
  }
  if (step.type === "nlu_extraction") {
    if (step.data.urgency === "emergency") return "warning";
  }
  if (step.type === "knowledge_search") {
    if (step.data.hit === false) return "warning";
  }
  return "normal";
}
