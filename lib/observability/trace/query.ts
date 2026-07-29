import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AvailabilityQueryRow,
  DecisionRow,
  KnowledgeSearchRow,
  LifecycleEventRow,
  MessageRow,
  NluExtractionRow,
  NotificationEventRow,
  TraceRawData,
  TurnEventRow,
} from "@/lib/observability/trace/reconstruct";

export type ConversationRow = { id: string; clinic_id: string; channel: string; status: string; started_at: string; ended_at: string | null };

type SingleResult = { data: unknown; error: unknown };
type ListResult = { data: unknown[] | null; error: unknown };

function extractRows<T>(label: string, result: PromiseSettledResult<ListResult>): T[] {
  if (result.status === "rejected") {
    console.error(`[observability] trace ${label} fetch failed, continuing with partial data`, result.reason);
    return [];
  }
  if (result.value.error) {
    console.error(`[observability] trace ${label} fetch returned an error, continuing with partial data`, result.value.error);
    return [];
  }
  return (result.value.data ?? []) as T[];
}

export type ConversationTraceRawData = TraceRawData & { conversation: ConversationRow | null };

/**
 * Fetches the conversation row plus every engine's logged rows for it,
 * all scoped by both conversation_id and clinic_id (defense in depth --
 * conversation_id alone is already clinic-scoped via ai_conversations,
 * but every other query here filters on clinic_id directly too,
 * matching the rest of the session's convention). Each source is
 * independent via Promise.allSettled -- same partial-failure posture as
 * lib/analytics/query.ts and lib/observability/health/query.ts.
 */
export async function fetchConversationTraceRawData(
  supabase: SupabaseClient,
  params: { clinicId: string; conversationId: string },
): Promise<ConversationTraceRawData> {
  const [
    conversationResult,
    messagesResult,
    nluResult,
    decisionsResult,
    availabilityResult,
    knowledgeResult,
    lifecycleResult,
    notificationResult,
    turnResult,
  ] = await Promise.allSettled([
    supabase
      .from("ai_conversations")
      .select("id, clinic_id, channel, status, started_at, ended_at")
      .eq("id", params.conversationId)
      .eq("clinic_id", params.clinicId)
      .maybeSingle(),
    supabase
      .from("ai_messages")
      .select("role, content, ai_action, created_at")
      .eq("conversation_id", params.conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_nlu_extractions")
      .select("intent, urgency, language, confidence, missing_fields, latency_ms, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
    supabase
      .from("ai_decisions")
      .select("decision_kind, reason, intent, urgency, confidence, latency_ms, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
    supabase
      .from("ai_availability_queries")
      .select("requested_date, options_count, fallback_count, latency_ms, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
    supabase
      .from("clinic_knowledge_searches")
      .select("query, hit, matched_record_ids, latency_ms, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
    supabase
      .from("appointment_lifecycle_events")
      .select("entity_type, event, from_status, to_status, actor, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
    supabase.from("notification_events").select("type, created_at").eq("conversation_id", params.conversationId).eq("clinic_id", params.clinicId),
    supabase
      .from("ai_turn_events")
      .select("outcome, iteration_count, latency_ms, model, created_at")
      .eq("conversation_id", params.conversationId)
      .eq("clinic_id", params.clinicId),
  ]);

  let conversation: ConversationRow | null = null;
  if (conversationResult.status === "fulfilled") {
    const { data, error } = conversationResult.value as SingleResult;
    if (error) console.error("[observability] trace conversation fetch returned an error", error);
    conversation = (data as ConversationRow | null) ?? null;
  } else {
    console.error("[observability] trace conversation fetch failed", conversationResult.reason);
  }

  return {
    conversation,
    messages: extractRows<MessageRow>("ai_messages", messagesResult),
    nluExtractions: extractRows<NluExtractionRow>("ai_nlu_extractions", nluResult),
    decisions: extractRows<DecisionRow>("ai_decisions", decisionsResult),
    availabilityQueries: extractRows<AvailabilityQueryRow>("ai_availability_queries", availabilityResult),
    knowledgeSearches: extractRows<KnowledgeSearchRow>("clinic_knowledge_searches", knowledgeResult),
    lifecycleEvents: extractRows<LifecycleEventRow>("appointment_lifecycle_events", lifecycleResult),
    notificationEvents: extractRows<NotificationEventRow>("notification_events", notificationResult),
    turnEvents: extractRows<TurnEventRow>("ai_turn_events", turnResult),
  };
}
