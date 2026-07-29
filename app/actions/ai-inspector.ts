"use server";

import type { AnalyticsResult } from "@/app/actions/analytics";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type ConversationListItem = {
  id: string;
  channel: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  patientId: string | null;
  patientName: string | null;
  patientPhone: string | null;
};

type ConversationListRow = {
  id: string;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  patient_id: string | null;
  patients: { full_name: string; phone: string | null } | null;
};

const LIST_LIMIT = 200;

/**
 * Browse list for the AI Conversation Inspector -- same table and
 * shape as the "Recent AI conversations" list already queried inline
 * in app/clinic/[clinicId]/settings/page.tsx, just with a larger
 * bound and the patient's phone included for search. Gated like every
 * other function in app/actions/analytics.ts (requireManager):
 * conversation rows themselves are readable by any clinic member, but
 * this feed is the entry point into the trace inspector, which reads
 * owner/admin-only telemetry tables, so it makes sense to gate the
 * whole list the same way rather than let a non-manager browse in and
 * then get errors per-conversation.
 */
export async function listConversationsAction(clinicId: string): Promise<AnalyticsResult<ConversationListItem[]>> {
  const user = await requireManager(clinicId);
  if (!user) return { error: "Only clinic owners and admins can view the AI conversation inspector." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, channel, status, started_at, ended_at, patient_id, patients(full_name, phone)")
    .eq("clinic_id", clinicId)
    .order("started_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) return { error: error.message };

  const rows = (data ?? []) as unknown as ConversationListRow[];
  return {
    data: rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      patientId: row.patient_id,
      patientName: row.patients?.full_name ?? null,
      patientPhone: row.patients?.phone ?? null,
    })),
  };
}
