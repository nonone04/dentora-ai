"use server";

import { getDashboardSummary } from "@/lib/analytics";
import type { DashboardSummary, DateRange, ReliabilityLabelValue } from "@/lib/analytics";
import { getConversationTrace, getSystemHealth } from "@/lib/observability";
import type { ConversationTrace, SystemHealth } from "@/lib/observability";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff-facing read API for the Analytics & AI Observability Platform
 * (lib/analytics, lib/observability). Same shape as app/actions/
 * clinic-knowledge.ts: requireManager gates every function here, and
 * the RLS policies on the underlying tables are the actual backstop --
 * ai_turn_events/ai_decisions/ai_availability_queries/
 * clinic_knowledge_searches are all owner/admin-only SELECT already, so
 * a non-manager who somehow got past requireManager would still be
 * blocked by Postgres. Uses the RLS-respecting client (not the AI
 * orchestrator's admin client) throughout -- these are read paths for
 * an authenticated staff session, not system-generated writes.
 */
export type AnalyticsResult<T> = { data: T } | { error: string };

const PERMISSION_ERROR = "Only clinic owners and admins can view analytics and AI observability data.";

export async function getDashboardSummaryAction(clinicId: string, range?: DateRange): Promise<AnalyticsResult<DashboardSummary>> {
  const user = await requireManager(clinicId);
  if (!user) return { error: PERMISSION_ERROR };

  const supabase = await createClient();
  const data = await getDashboardSummary(supabase, { clinicId, range });
  return { data };
}

export async function getSystemHealthAction(clinicId: string, windowHours?: number): Promise<AnalyticsResult<SystemHealth>> {
  const user = await requireManager(clinicId);
  if (!user) return { error: PERMISSION_ERROR };

  const supabase = await createClient();
  const data = await getSystemHealth(supabase, { clinicId, windowHours });
  return { data };
}

export type PatientInsightRow = {
  patientId: string;
  fullName: string;
  reliabilityLabel: ReliabilityLabelValue;
  reliabilityScore: number;
};

/**
 * Named patients behind patient-insights.tsx's reliability distribution --
 * computePatientBehaviorMetrics (lib/analytics/patient-behavior.ts) only
 * counts buckets and intentionally discards patient identity, so this is a
 * separate, identity-preserving query over the same patient_profiles table
 * for the dashboard's "needs a nudge" recall row. Lowest reliability score
 * first, since that's the actionable list.
 */
export async function getPatientInsightRowsAction(clinicId: string, limit = 10): Promise<AnalyticsResult<PatientInsightRow[]>> {
  const user = await requireManager(clinicId);
  if (!user) return { error: PERMISSION_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_profiles")
    .select("patient_id, reliability_label, reliability_score, patients(full_name)")
    .eq("clinic_id", clinicId)
    .order("reliability_score", { ascending: true })
    .limit(limit);

  if (error) return { error: error.message };

  const rows = (data ?? []) as unknown as {
    patient_id: string;
    reliability_label: ReliabilityLabelValue;
    reliability_score: number;
    patients: { full_name: string } | null;
  }[];

  return {
    data: rows.map((row) => ({
      patientId: row.patient_id,
      fullName: row.patients?.full_name ?? "",
      reliabilityLabel: row.reliability_label,
      reliabilityScore: row.reliability_score,
    })),
  };
}

export async function getConversationTraceAction(clinicId: string, conversationId: string): Promise<AnalyticsResult<ConversationTrace>> {
  const user = await requireManager(clinicId);
  if (!user) return { error: PERMISSION_ERROR };

  const supabase = await createClient();
  const trace = await getConversationTrace(supabase, { clinicId, conversationId });
  if (!trace) return { error: "Conversation not found." };
  return { data: trace };
}
