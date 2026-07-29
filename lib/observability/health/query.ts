import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionInput, DeliveryInput, TurnEventInput } from "@/lib/analytics";
import type { KnowledgeSearchInput } from "@/lib/observability/health/checks";

export type HealthRawData = {
  turnEvents: TurnEventInput[];
  decisions: DecisionInput[];
  deliveries: DeliveryInput[];
  knowledgeSearches: KnowledgeSearchInput[];
};

type QueryResult = { data: unknown[] | null; error: unknown };

function extractRows<T>(label: string, result: PromiseSettledResult<QueryResult>): T[] {
  if (result.status === "rejected") {
    console.error(`[observability] ${label} fetch failed, continuing with partial data`, result.reason);
    return [];
  }
  if (result.value.error) {
    console.error(`[observability] ${label} fetch returned an error, continuing with partial data`, result.value.error);
    return [];
  }
  return (result.value.data ?? []) as T[];
}

/** Same recovery-from-partial-failure posture as lib/analytics/query.ts's fetchDashboardRawData -- one failing source degrades to an empty array, never fails the whole health check. */
export async function fetchHealthRawData(supabase: SupabaseClient, params: { clinicId: string; sinceIso: string }): Promise<HealthRawData> {
  const [turnEventsResult, decisionsResult, deliveriesResult, searchesResult] = await Promise.allSettled([
    supabase.from("ai_turn_events").select("outcome, latency_ms").eq("clinic_id", params.clinicId).gte("created_at", params.sinceIso),
    supabase.from("ai_decisions").select("decision_kind, intent, confidence").eq("clinic_id", params.clinicId).gte("created_at", params.sinceIso),
    supabase.from("notification_deliveries").select("status, channel, attempts").eq("clinic_id", params.clinicId).gte("created_at", params.sinceIso),
    supabase.from("clinic_knowledge_searches").select("hit").eq("clinic_id", params.clinicId).gte("created_at", params.sinceIso),
  ]);

  return {
    turnEvents: extractRows("ai_turn_events", turnEventsResult),
    decisions: extractRows("ai_decisions", decisionsResult),
    deliveries: extractRows("notification_deliveries", deliveriesResult),
    knowledgeSearches: extractRows("clinic_knowledge_searches", searchesResult),
  };
}
