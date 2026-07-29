import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateRange } from "@/lib/analytics/types";

export type TelemetryEventRow = {
  event_name: string;
  clinic_id: string | null;
  user_id: string | null;
  occurred_at: string;
  properties: Record<string, unknown>;
};

export type ClinicRow = { id: string; created_at: string };

export type TelemetryRawData = {
  events: TelemetryEventRow[];
  clinics: ClinicRow[];
};

type QueryResult = { data: unknown[] | null; error: unknown };

function extractRows<T>(label: string, result: PromiseSettledResult<QueryResult>): T[] {
  if (result.status === "rejected") {
    console.error(`[telemetry] ${label} fetch failed, continuing with partial data`, result.reason);
    return [];
  }
  if (result.value.error) {
    console.error(`[telemetry] ${label} fetch returned an error, continuing with partial data`, result.value.error);
    return [];
  }
  return (result.value.data ?? []) as T[];
}

/**
 * Gathers the raw datasets the internal dashboard's aggregations
 * (lib/telemetry/dashboard.ts) run over. Same resilient-to-partial-
 * failure posture as lib/analytics/query.ts: each source is fetched
 * independently, and a failing one degrades to an empty array rather
 * than failing the whole dashboard.
 *
 * clinics is intentionally NOT filtered by the date range -- funnel/
 * activation math needs every clinic's created_at to compute cohorts,
 * even ones created before `range.from`.
 */
export async function fetchTelemetryRawData(
  supabase: SupabaseClient,
  params: { range: DateRange },
): Promise<TelemetryRawData> {
  const [eventsResult, clinicsResult] = await Promise.allSettled([
    supabase
      .from("analytics_events")
      .select("event_name, clinic_id, user_id, occurred_at, properties")
      .gte("occurred_at", params.range.from)
      .lte("occurred_at", params.range.to),
    supabase.from("clinics").select("id, created_at"),
  ]);

  return {
    events: extractRows("analytics_events", eventsResult),
    clinics: extractRows("clinics", clinicsResult),
  };
}
