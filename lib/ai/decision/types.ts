import type { NLUEntityField } from "@/lib/ai/nlu/types";

/**
 * The Decision Engine's typed output -- a deterministic verdict on what
 * the orchestrator should do with this turn, computed from the
 * structured NLUExtraction alone (see lib/ai/decision/router.ts). No
 * network/DB access happens here; the orchestrator is responsible for
 * carrying out whichever decision comes back.
 */
export type AIDecisionKind =
  | "ask_follow_up"
  | "execute_tool"
  | "escalate_to_staff"
  | "emergency_workflow"
  | "reply_directly";

export type AIDecision =
  | { kind: "ask_follow_up"; reason: string; missingFields: NLUEntityField[]; reply: string }
  | { kind: "execute_tool"; reason: string }
  | { kind: "escalate_to_staff"; reason: string; reply: string }
  | { kind: "emergency_workflow"; reason: string; reply: string }
  | { kind: "reply_directly"; reason: string; reply: string };

export type DecisionContext = {
  /** Whether the patient is already identified from conversation context (e.g. an existing patientId). */
  patientKnown?: boolean;
  /** Clinic's default_language, used as a fallback when the detected language isn't one we have copy for. */
  clinicDefaultLanguage?: string | null;
};
