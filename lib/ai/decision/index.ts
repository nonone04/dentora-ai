export { CONFIDENCE_THRESHOLDS } from "@/lib/ai/decision/thresholds";
export { isEmergency } from "@/lib/ai/decision/emergency";
export { buildEmergencyReply, buildEscalationReply, buildGreetingReply } from "@/lib/ai/decision/replies";
export { recordDecisionEvent } from "@/lib/ai/decision/log";
export { decide } from "@/lib/ai/decision/router";
export type { AIDecision, AIDecisionKind, DecisionContext } from "@/lib/ai/decision/types";
