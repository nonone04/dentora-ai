import type { AIDecisionKind } from "@/lib/ai/decision/types";
import { isExpired } from "@/lib/ai/state/expiration";
import { createInitialState } from "@/lib/ai/state/factory";
import { transition } from "@/lib/ai/state/machine";
import { mergeExtraction } from "@/lib/ai/state/merge";
import type { ConversationState } from "@/lib/ai/state/types";
import { parseConversationState, stateToRow, type ConversationStateRow } from "@/lib/ai/state/validate";
import type { NLUExtraction } from "@/lib/ai/nlu/types";
import type { createAdminClient } from "@/lib/supabase/admin";

const MAX_PERSIST_ATTEMPTS = 2;

/**
 * Loads the conversation's accumulated state, or a fresh one if none
 * exists yet, it's expired, or the read itself failed -- never throws.
 * "Recovery after interruption" (a crashed prior turn, a DB blip, a
 * genuinely new conversation) and expiration (lib/ai/state/expiration.ts)
 * both resolve the same way: start clean rather than block the turn.
 */
export async function loadConversationState(
  supabase: ReturnType<typeof createAdminClient>,
  params: { clinicId: string; conversationId: string },
): Promise<ConversationState> {
  try {
    const { data, error } = await supabase
      .from("conversation_states")
      .select("*")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId)
      .maybeSingle();

    if (error || !data) return createInitialState(params);

    const state = parseConversationState(data as ConversationStateRow);
    if (isExpired(state, new Date())) {
      console.log(`[ai:state] conv=${params.conversationId} state expired -- resetting to a fresh conversation`);
      return createInitialState(params);
    }
    return state;
  } catch (err) {
    console.error("[ai:state] failed to load conversation state, starting fresh", err instanceof Error ? err.message : err);
    return createInitialState(params);
  }
}

/**
 * Writes a state -- an insert for a never-persisted state (version 0),
 * otherwise a compare-and-swap update gated on the version the caller
 * read. `conflict: true` covers both a losing insert race (unique
 * conversation_id) and a losing CAS (version already moved), so the
 * caller doesn't need to distinguish them -- either way, someone else
 * updated first and the right move is to reload and re-merge.
 */
async function persistConversationState(
  supabase: ReturnType<typeof createAdminClient>,
  state: ConversationState,
): Promise<{ state: ConversationState; conflict: boolean }> {
  const nextVersion = state.version + 1;
  const row = stateToRow(state, nextVersion);

  try {
    if (state.version === 0) {
      const { data, error } = await supabase.from("conversation_states").insert(row).select().maybeSingle();
      if (error || !data) return { state, conflict: true };
      return { state: parseConversationState(data as ConversationStateRow), conflict: false };
    }

    const { data, error } = await supabase
      .from("conversation_states")
      .update(row)
      .eq("conversation_id", state.conversationId)
      .eq("version", state.version)
      .select()
      .maybeSingle();

    if (error || !data) return { state, conflict: true };
    return { state: parseConversationState(data as ConversationStateRow), conflict: false };
  } catch (err) {
    console.error("[ai:state] failed to persist conversation state", err instanceof Error ? err.message : err);
    return { state, conflict: true };
  }
}

/**
 * The per-turn entry point: load -> merge this turn's NLUExtraction ->
 * transition status per the Decision Engine's outcome -> persist, with
 * bounded optimistic-concurrency retries covering a concurrent update to
 * the same conversation (e.g. a duplicate webhook delivery racing two
 * turns). Never throws and never blocks the turn indefinitely -- if
 * retries are exhausted, returns the best local merge unpersisted; the
 * next turn's load reconciles from whatever actually made it to the
 * database.
 */
export async function applyIncrementalUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clinicId: string;
    conversationId: string;
    nlu: NLUExtraction;
    patientKnown?: boolean;
    decisionKind: AIDecisionKind;
  },
): Promise<ConversationState> {
  let current = await loadConversationState(supabase, params);

  for (let attempt = 1; attempt <= MAX_PERSIST_ATTEMPTS; attempt += 1) {
    const merged = mergeExtraction(current, params.nlu, { patientKnown: params.patientKnown });
    const withStatus: ConversationState = { ...merged, status: transition(merged.status, params.decisionKind) };

    const { state, conflict } = await persistConversationState(supabase, withStatus);
    if (!conflict) return state;

    console.warn(`[ai:state] conv=${params.conversationId} persist conflict on attempt ${attempt}, reloading`);
    current = await loadConversationState(supabase, params);
  }

  console.error(
    `[ai:state] conv=${params.conversationId} giving up on persisting after ${MAX_PERSIST_ATTEMPTS} attempts, using local state`,
  );
  const fallback = mergeExtraction(current, params.nlu, { patientKnown: params.patientKnown });
  return { ...fallback, status: transition(fallback.status, params.decisionKind) };
}
