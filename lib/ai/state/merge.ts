import { NLU_ENTITY_FIELDS, type NLUEntities, type NLUExtraction, type NLUUrgency } from "@/lib/ai/nlu/types";
import { computeMissingFields } from "@/lib/ai/nlu/validate";
import type { ConversationState } from "@/lib/ai/state/types";

const URGENCY_RANK: Record<NLUUrgency, number> = { low: 0, medium: 1, high: 2, emergency: 3 };

/** Never downgrades -- a conversation that touched "emergency" once stays flagged that way for the rest of it, even if the patient calms down in a later message. */
function maxUrgency(a: NLUUrgency, b: NLUUrgency): NLUUrgency {
  return URGENCY_RANK[b] >= URGENCY_RANK[a] ? b : a;
}

/**
 * Fills gaps, never blanks: a new non-null value (the patient mentioned
 * or corrected it this turn) always wins over what was known before; a
 * new null (this turn's message just didn't touch that field) never
 * erases a previously-known value. This one rule handles both ordinary
 * multi-turn slot-filling ("cleaning" then, next turn, "tomorrow") and
 * mid-conversation corrections ("actually make it Friday") identically.
 */
function mergeEntities(existing: NLUEntities, incoming: NLUEntities): NLUEntities {
  const merged = { ...existing };
  for (const field of NLU_ENTITY_FIELDS) {
    if (incoming[field] !== null) merged[field] = incoming[field];
  }
  return merged;
}

/**
 * Folds one turn's NLUExtraction into the conversation's accumulated
 * state. Pure -- no I/O, no status transition (see machine.ts), no
 * knowledge of the Decision Engine -- so it's trivially unit-testable
 * and safely re-appliable (lib/ai/state/store.ts re-merges on a
 * persistence conflict, which only works because this is idempotent
 * with respect to re-merging the same nlu onto a fresher base).
 */
export function mergeExtraction(
  state: ConversationState,
  nlu: NLUExtraction,
  options: { patientKnown?: boolean } = {},
): ConversationState {
  // An "other"-classified turn (e.g. a short reply like "tomorrow" that
  // the extractor couldn't tie to an intent on its own) shouldn't reset
  // an already-established intent -- the accumulated entities still
  // belong to whatever the conversation was actually about.
  const intent = nlu.intent !== "other" ? nlu.intent : state.intent;
  const entities = mergeEntities(state.entities, nlu.entities);
  const urgency = maxUrgency(state.urgency, nlu.urgency);
  const language = nlu.language !== "other" ? nlu.language : state.language;

  return {
    ...state,
    intent,
    entities,
    urgency,
    language,
    confidence: nlu.confidence,
    missingFields: computeMissingFields(intent, entities, { patientKnown: options.patientKnown }),
    turnCount: state.turnCount + 1,
    lastMessage: nlu.rawMessage,
  };
}
