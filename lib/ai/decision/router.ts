import { CONFIDENCE_THRESHOLDS } from "@/lib/ai/decision/thresholds";
import { isEmergency } from "@/lib/ai/decision/emergency";
import { buildEmergencyReply, buildEscalationReply, buildGreetingReply } from "@/lib/ai/decision/replies";
import type { AIDecision, DecisionContext } from "@/lib/ai/decision/types";
import { buildFollowUpQuestion } from "@/lib/ai/nlu/follow-up";
import type { NLUExtraction } from "@/lib/ai/nlu/types";
import { computeMissingFields } from "@/lib/ai/nlu/validate";

/**
 * The Decision Engine's router: a pure function from (NLUExtraction,
 * DecisionContext) to a single AIDecision. Deliberately has no side
 * effects and no I/O -- the orchestrator interprets the result (sending
 * a reply, marking a conversation escalated, notifying staff, or
 * falling through to the LLM tool-selection loop). This is what keeps
 * every business rule here fully unit-testable without mocking Supabase
 * or an LLM client.
 *
 * Precedence, most urgent first:
 *   1. Emergency -- always wins, no confidence threshold (see emergency.ts).
 *   2. Explicit escalation intent, confident enough to trust.
 *   3. A bare greeting, confident enough to answer without a tool.
 *   4. Missing required fields for the detected intent, confident enough to ask.
 *   5. Default: defer to the tool-selection model with full conversation context.
 */
export function decide(nlu: NLUExtraction, context: DecisionContext = {}): AIDecision {
  const replyOptions = { language: nlu.language, clinicDefaultLanguage: context.clinicDefaultLanguage };

  if (isEmergency(nlu)) {
    return {
      kind: "emergency_workflow",
      reason: "Message matched emergency urgency/keywords -- dental emergencies are escalated immediately regardless of confidence.",
      reply: buildEmergencyReply(replyOptions),
    };
  }

  if (nlu.intent === "escalate_to_staff" && nlu.confidence >= CONFIDENCE_THRESHOLDS.escalation) {
    return {
      kind: "escalate_to_staff",
      reason: `Patient explicitly asked for staff (confidence ${nlu.confidence.toFixed(2)} >= ${CONFIDENCE_THRESHOLDS.escalation}).`,
      reply: buildEscalationReply(replyOptions),
    };
  }

  if (nlu.intent === "greeting" && nlu.confidence >= CONFIDENCE_THRESHOLDS.greeting) {
    return {
      kind: "reply_directly",
      reason: `Bare greeting (confidence ${nlu.confidence.toFixed(2)} >= ${CONFIDENCE_THRESHOLDS.greeting}) -- answered without invoking a tool.`,
      reply: buildGreetingReply(replyOptions),
    };
  }

  const missingFields = computeMissingFields(nlu.intent, nlu.entities, { patientKnown: context.patientKnown });
  if (missingFields.length > 0 && nlu.confidence >= CONFIDENCE_THRESHOLDS.followUp) {
    return {
      kind: "ask_follow_up",
      reason: `Missing required fields for ${nlu.intent} (confidence ${nlu.confidence.toFixed(2)} >= ${CONFIDENCE_THRESHOLDS.followUp}): ${missingFields.join(", ")}.`,
      missingFields,
      reply: buildFollowUpQuestion(missingFields, replyOptions),
    };
  }

  return {
    kind: "execute_tool",
    reason: "No deterministic rule matched -- deferring to the tool-selection model with full conversation context.",
  };
}
