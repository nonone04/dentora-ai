import type { NLUEntities, NLUEntityField, NLUIntent, NLULanguage, NLUUrgency } from "@/lib/ai/nlu/types";

/**
 * Lifecycle status for a conversation's accumulated slot-filling state.
 * Driven by the Decision Engine's per-turn outcome -- see
 * lib/ai/state/machine.ts. "escalated" is sticky (see machine.ts); the
 * others are just the latest decision's own label, not a strict
 * one-way pipeline.
 */
export const CONVERSATION_STATUSES = ["active", "collecting", "ready", "escalated"] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/**
 * Accumulated, persisted state for one ai_conversations row -- the
 * result of folding every turn's NLUExtraction together (lib/ai/state/
 * merge.ts) rather than each turn starting from scratch. Exposed to
 * downstream tool execution via AIToolContext.conversationState
 * (lib/ai/tools/types.ts).
 */
export type ConversationState = {
  clinicId: string;
  conversationId: string;
  status: ConversationStatus;
  intent: NLUIntent;
  entities: NLUEntities;
  /** Highest urgency observed across the whole conversation, not just this turn -- see mergeExtraction. */
  urgency: NLUUrgency;
  /** Most recently detected language, so a mid-conversation language switch is followed. */
  language: NLULanguage;
  /** This turn's raw NLU confidence -- not accumulated/averaged across turns. */
  confidence: number;
  /** Recomputed from the accumulated entities on every merge -- never trusted from storage as-is. */
  missingFields: NLUEntityField[];
  turnCount: number;
  lastMessage: string;
  /** 0 for a state that has never been persisted yet -- see lib/ai/state/store.ts's insert-vs-update branch. */
  version: number;
  lastActivityAt: string;
};
