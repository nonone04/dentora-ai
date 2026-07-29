import type { SupabaseClient } from "@supabase/supabase-js";
import { reconstructTraceSteps } from "@/lib/observability/trace/reconstruct";
import { fetchConversationTraceRawData } from "@/lib/observability/trace/query";
import type { ConversationTrace } from "@/lib/observability/trace/types";

/**
 * Top-level, dashboard-facing entry point: reconstructs one
 * conversation's full step-by-step trace across every engine that
 * touched it. Returns null when the conversation doesn't exist (or
 * doesn't belong to this clinic) -- never throws otherwise, since the
 * underlying fetch already degrades every failing source to an empty
 * array.
 */
export async function getConversationTrace(
  supabase: SupabaseClient,
  params: { clinicId: string; conversationId: string },
): Promise<ConversationTrace | null> {
  const raw = await fetchConversationTraceRawData(supabase, params);
  if (!raw.conversation) return null;

  return {
    conversationId: params.conversationId,
    clinicId: params.clinicId,
    channel: raw.conversation.channel,
    status: raw.conversation.status,
    startedAt: raw.conversation.started_at,
    endedAt: raw.conversation.ended_at,
    steps: reconstructTraceSteps(raw),
  };
}
