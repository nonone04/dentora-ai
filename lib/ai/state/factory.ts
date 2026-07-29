import { EMPTY_ENTITIES } from "@/lib/ai/nlu/types";
import type { ConversationState } from "@/lib/ai/state/types";

/** A brand-new, never-persisted conversation state -- version 0 is the signal lib/ai/state/store.ts uses to insert rather than CAS-update. */
export function createInitialState(params: { clinicId: string; conversationId: string }): ConversationState {
  return {
    clinicId: params.clinicId,
    conversationId: params.conversationId,
    status: "active",
    intent: "other",
    entities: { ...EMPTY_ENTITIES },
    urgency: "low",
    language: "other",
    confidence: 0,
    missingFields: [],
    turnCount: 0,
    lastMessage: "",
    version: 0,
    lastActivityAt: new Date().toISOString(),
  };
}
