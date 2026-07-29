import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAIHealthCheck, computeKnowledgeHealthCheck, computeNotificationHealthCheck, computeOverallStatus } from "@/lib/observability/health/checks";
import { fetchHealthRawData } from "@/lib/observability/health/query";
import type { SystemHealth } from "@/lib/observability/types";

const DEFAULT_WINDOW_HOURS = 24;

/**
 * Top-level, dashboard-facing entry point: rolls up the AI orchestrator,
 * notification delivery, and clinic knowledge retrieval into one
 * overall status (the worst of the three) plus each component's own
 * numbers. Never throws -- a totally failed fetch degrades to
 * "healthy" (zero samples never trips a threshold, see
 * lib/observability/health/thresholds.ts's MIN_SAMPLE_SIZE) rather than
 * an exception breaking the health page.
 */
export async function getSystemHealth(supabase: SupabaseClient, params: { clinicId: string; windowHours?: number }): Promise<SystemHealth> {
  const windowHours = params.windowHours ?? DEFAULT_WINDOW_HOURS;
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const raw = await fetchHealthRawData(supabase, { clinicId: params.clinicId, sinceIso });

  const components = [
    computeAIHealthCheck({ turnEvents: raw.turnEvents, decisions: raw.decisions }),
    computeNotificationHealthCheck(raw.deliveries),
    computeKnowledgeHealthCheck(raw.knowledgeSearches),
  ];

  return {
    clinicId: params.clinicId,
    status: computeOverallStatus(components),
    components,
    windowHours,
    generatedAt: new Date().toISOString(),
  };
}
