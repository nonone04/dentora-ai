import type { AIDecisionKind } from "@/lib/ai/decision/types";
import type { ConversationStatus } from "@/lib/ai/state/types";

const DECISION_TO_STATUS: Record<AIDecisionKind, ConversationStatus> = {
  ask_follow_up: "collecting",
  execute_tool: "ready",
  escalate_to_staff: "escalated",
  emergency_workflow: "escalated",
  reply_directly: "active",
};

/**
 * Deterministic state machine: the next ConversationStatus given the
 * current one and this turn's Decision Engine outcome (lib/ai/decision).
 * Every combination maps directly *except* one guarded rule:
 *
 * Escalated is sticky. Once a conversation has been hand ed to staff,
 * nothing routed here -- a stray greeting, an ambiguous message that
 * fell through to the tool-selection loop -- is allowed to silently
 * move it back to a normal working status; that would make an
 * unresolved escalation quietly disappear from a staff-facing view.
 * Only another escalation/emergency this engine detects keeps it there
 * (trivially, since both map to "escalated" anyway). Un-escalating is a
 * staff action and out of scope for this engine.
 */
export function transition(current: ConversationStatus, decisionKind: AIDecisionKind): ConversationStatus {
  if (current === "escalated" && decisionKind !== "escalate_to_staff" && decisionKind !== "emergency_workflow") {
    return "escalated";
  }
  return DECISION_TO_STATUS[decisionKind];
}
