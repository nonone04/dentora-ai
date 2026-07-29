import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAIResolutionMetrics } from "@/lib/analytics/ai-resolution";
import { computeAppointmentMetrics } from "@/lib/analytics/appointments";
import { computeNotificationMetrics } from "@/lib/analytics/notifications";
import { computePatientBehaviorMetrics } from "@/lib/analytics/patient-behavior";
import { fetchDashboardRawData } from "@/lib/analytics/query";
import type { DashboardSummary, DateRange } from "@/lib/analytics/types";

const DEFAULT_RANGE_DAYS = 30;

export function defaultDateRange(now: Date = new Date()): DateRange {
  const from = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}

/**
 * Top-level, dashboard-facing entry point: fetches every raw dataset
 * (lib/analytics/query.ts, resilient to partial failures on its own)
 * and runs each pure aggregator over it. Never throws -- a completely
 * failed fetch just degrades to zeroed metrics for that section, since
 * every compute* function handles an empty array cleanly.
 */
export async function getDashboardSummary(
  supabase: SupabaseClient,
  params: { clinicId: string; range?: DateRange },
): Promise<DashboardSummary> {
  const range = params.range ?? defaultDateRange();
  const raw = await fetchDashboardRawData(supabase, { clinicId: params.clinicId, range });

  return {
    clinicId: params.clinicId,
    range,
    appointments: computeAppointmentMetrics(raw.appointments),
    aiResolution: computeAIResolutionMetrics({ turnEvents: raw.turnEvents, decisions: raw.decisions }),
    notifications: computeNotificationMetrics(raw.deliveries),
    patientBehavior: computePatientBehaviorMetrics(raw.patientProfiles, { rangeFrom: range.from }),
    generatedAt: new Date().toISOString(),
  };
}
