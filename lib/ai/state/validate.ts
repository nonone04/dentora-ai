import { isNLUIntent, isNLULanguage, isNLUUrgency, clampConfidence, computeMissingFields, normalizeEntities } from "@/lib/ai/nlu/validate";
import { CONVERSATION_STATUSES, type ConversationState, type ConversationStatus } from "@/lib/ai/state/types";

export function isConversationStatus(value: unknown): value is ConversationStatus {
  return typeof value === "string" && (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

/** Shape of a conversation_states row as returned by supabase-js (snake_case, untyped JSON columns). */
export type ConversationStateRow = {
  clinic_id: unknown;
  conversation_id: unknown;
  status: unknown;
  intent: unknown;
  entities: unknown;
  urgency: unknown;
  language: unknown;
  confidence: unknown;
  turn_count: unknown;
  last_message: unknown;
  version: unknown;
  last_activity_at: unknown;
};

/**
 * Validates + coerces an untrusted DB row into a typed ConversationState
 * -- same defensive posture as lib/ai/nlu/validate.ts's
 * parseNLUExtraction: a malformed or partially-corrupt row degrades to
 * safe defaults per-field rather than throwing. missingFields is always
 * recomputed from the row's own intent+entities rather than trusted
 * from storage, for the same reason NLUExtraction.missingFields is.
 */
export function parseConversationState(row: ConversationStateRow): ConversationState {
  const entities = normalizeEntities(row.entities);
  const intent = isNLUIntent(row.intent) ? row.intent : "other";

  return {
    clinicId: typeof row.clinic_id === "string" ? row.clinic_id : "",
    conversationId: typeof row.conversation_id === "string" ? row.conversation_id : "",
    status: isConversationStatus(row.status) ? row.status : "active",
    intent,
    entities,
    urgency: isNLUUrgency(row.urgency) ? row.urgency : "low",
    language: isNLULanguage(row.language) ? row.language : "other",
    confidence: clampConfidence(row.confidence),
    missingFields: computeMissingFields(intent, entities),
    turnCount: typeof row.turn_count === "number" ? row.turn_count : 0,
    lastMessage: typeof row.last_message === "string" ? row.last_message : "",
    version: typeof row.version === "number" ? row.version : 0,
    lastActivityAt: typeof row.last_activity_at === "string" ? row.last_activity_at : new Date(0).toISOString(),
  };
}

/** The inverse mapping, for writes -- version is passed separately since the caller (store.ts) decides insert-initial vs. CAS-increment. */
export function stateToRow(state: ConversationState, version: number): Record<string, unknown> {
  return {
    clinic_id: state.clinicId,
    conversation_id: state.conversationId,
    status: state.status,
    intent: state.intent,
    entities: state.entities,
    urgency: state.urgency,
    language: state.language,
    confidence: state.confidence,
    missing_fields: state.missingFields,
    turn_count: state.turnCount,
    last_message: state.lastMessage,
    version,
    last_activity_at: new Date().toISOString(),
  };
}
