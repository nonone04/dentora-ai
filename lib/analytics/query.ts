import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentMetricsInput } from "@/lib/analytics/appointments";
import type { DecisionInput, TurnEventInput } from "@/lib/analytics/ai-resolution";
import type { DeliveryInput } from "@/lib/analytics/notifications";
import type { PatientProfileInput } from "@/lib/analytics/patient-behavior";
import type { DateRange } from "@/lib/analytics/types";

export type DashboardRawData = {
  appointments: AppointmentMetricsInput[];
  turnEvents: TurnEventInput[];
  decisions: DecisionInput[];
  deliveries: DeliveryInput[];
  patientProfiles: PatientProfileInput[];
};

type QueryResult = { data: unknown[] | null; error: unknown };

function extractRows<T>(label: string, result: PromiseSettledResult<QueryResult>): T[] {
  if (result.status === "rejected") {
    console.error(`[analytics] ${label} fetch failed, continuing with partial data`, result.reason);
    return [];
  }
  if (result.value.error) {
    console.error(`[analytics] ${label} fetch returned an error, continuing with partial data`, result.value.error);
    return [];
  }
  return (result.value.data ?? []) as T[];
}

/**
 * Gathers every raw dataset the dashboard's aggregations run over,
 * scoped to one clinic and (mostly) one date range. Each source is
 * fetched independently via Promise.allSettled -- same
 * recovery-from-partial-failure posture as lib/ai/patient/store.ts's
 * gatherFacts: a single failing query degrades that one section to an
 * empty array rather than failing the whole dashboard. Reuses existing
 * tables only (appointments, ai_turn_events, ai_decisions,
 * notification_deliveries, patient_profiles) -- lib/analytics adds no
 * tables of its own.
 *
 * patient_profiles is intentionally NOT filtered by the date range --
 * the new-vs-returning split needs the whole current population,
 * computed downstream in lib/analytics/patient-behavior.ts by comparing
 * each profile's created_at against range.from.
 */
export async function fetchDashboardRawData(supabase: SupabaseClient, params: { clinicId: string; range: DateRange }): Promise<DashboardRawData> {
  const [appointmentsResult, turnEventsResult, decisionsResult, deliveriesResult, profilesResult] = await Promise.allSettled([
    supabase
      .from("appointments")
      .select("status, source")
      .eq("clinic_id", params.clinicId)
      .gte("created_at", params.range.from)
      .lte("created_at", params.range.to),
    supabase
      .from("ai_turn_events")
      .select("outcome, latency_ms")
      .eq("clinic_id", params.clinicId)
      .gte("created_at", params.range.from)
      .lte("created_at", params.range.to),
    supabase
      .from("ai_decisions")
      .select("decision_kind, intent, confidence")
      .eq("clinic_id", params.clinicId)
      .gte("created_at", params.range.from)
      .lte("created_at", params.range.to),
    supabase
      .from("notification_deliveries")
      .select("status, channel, attempts")
      .eq("clinic_id", params.clinicId)
      .gte("created_at", params.range.from)
      .lte("created_at", params.range.to),
    supabase.from("patient_profiles").select("reliability_label, reliability_score, preferred_channel, created_at").eq("clinic_id", params.clinicId),
  ]);

  return {
    appointments: extractRows("appointments", appointmentsResult),
    turnEvents: extractRows("ai_turn_events", turnEventsResult),
    decisions: extractRows("ai_decisions", decisionsResult),
    deliveries: extractRows("notification_deliveries", deliveriesResult),
    patientProfiles: extractRows("patient_profiles", profilesResult),
  };
}
