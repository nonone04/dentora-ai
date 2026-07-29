import type { SupabaseClient } from "@supabase/supabase-js";
import { computeReliabilityScore, type AppointmentOutcome } from "@/lib/ai/patient/reliability";
import { learnCommunicationPreferences, learnSchedulingPreferences } from "@/lib/ai/patient/preferences";
import { generatePatientSummary } from "@/lib/ai/patient/summary";
import { describeActivityEvent } from "@/lib/ai/patient/timeline";
import type { PatientProfile } from "@/lib/ai/patient/types";
import { parsePatientProfileRow, patientProfileToRow, type PatientProfileRow } from "@/lib/ai/patient/validate";

const MAX_PERSIST_ATTEMPTS = 2;
const RECENT_ACTIVITY_LIMIT = 5;

const SETTLED_OUTCOMES = new Set(["completed", "no_show", "cancelled"]);

/** Loads the persisted profile, or null if none has ever been computed. Never throws -- a read failure is treated the same as "not found yet". */
export async function loadPatientProfile(
  supabase: SupabaseClient,
  params: { clinicId: string; patientId: string },
): Promise<PatientProfile | null> {
  try {
    const { data, error } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .maybeSingle();

    if (error || !data) return null;
    return parsePatientProfileRow(data as PatientProfileRow);
  } catch (err) {
    console.error("[ai:patient] failed to load patient profile", err instanceof Error ? err.message : err);
    return null;
  }
}

type ComputedFacts = {
  patientName: string;
  outcomes: AppointmentOutcome[];
  channels: string[];
  completed: { dentistId: string; startAt: string }[];
  recentActivity: string[];
};

/**
 * Gathers every input the profile is computed from. Each source is
 * fetched independently via Promise.allSettled rather than Promise.all
 * -- a single query failing (a transient DB blip on, say, the
 * ai_conversations fetch) degrades that one input to empty/unknown
 * rather than preventing the whole profile from being computed from
 * whatever data *did* come back. This is the "recovery from partial
 * failures" behavior.
 */
async function gatherFacts(supabase: SupabaseClient, params: { clinicId: string; patientId: string }): Promise<ComputedFacts> {
  const [patientResult, appointmentsResult, conversationsResult, activityResult] = await Promise.allSettled([
    supabase.from("patients").select("full_name").eq("id", params.patientId).eq("clinic_id", params.clinicId).maybeSingle(),
    supabase
      .from("appointments")
      .select("dentist_id, start_at, status")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId),
    supabase.from("ai_conversations").select("channel").eq("clinic_id", params.clinicId).eq("patient_id", params.patientId),
    supabase
      .from("patient_activity_events")
      .select("type, created_at")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .order("created_at", { ascending: false })
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  const patientRows = patientResult.status === "fulfilled" ? patientResult.value.data : null;
  const appointmentRows = appointmentsResult.status === "fulfilled" ? (appointmentsResult.value.data ?? []) : [];
  const conversationRows = conversationsResult.status === "fulfilled" ? (conversationsResult.value.data ?? []) : [];
  const activityRows = activityResult.status === "fulfilled" ? (activityResult.value.data ?? []) : [];

  for (const [label, result] of [
    ["patients", patientResult],
    ["appointments", appointmentsResult],
    ["ai_conversations", conversationsResult],
    ["patient_activity_events", activityResult],
  ] as const) {
    if (result.status === "rejected") {
      console.error(`[ai:patient] ${label} fetch failed, continuing with partial data`, result.reason);
    }
  }

  const outcomes: AppointmentOutcome[] = (appointmentRows as { status: string }[])
    .map((row) => row.status)
    .filter((status): status is AppointmentOutcome => SETTLED_OUTCOMES.has(status));

  const completed = (appointmentRows as { status: string; dentist_id: string; start_at: string }[])
    .filter((row) => row.status === "completed")
    .map((row) => ({ dentistId: row.dentist_id, startAt: row.start_at }));

  return {
    patientName: (patientRows as { full_name?: string } | null)?.full_name ?? "This patient",
    outcomes,
    channels: (conversationRows as { channel: string }[]).map((row) => row.channel),
    completed,
    recentActivity: (activityRows as { type: Parameters<typeof describeActivityEvent>[0] }[]).map((row) =>
      describeActivityEvent(row.type),
    ),
  };
}

async function persistProfile(
  supabase: SupabaseClient,
  profile: PatientProfile,
  currentVersion: number,
): Promise<{ profile: PatientProfile; conflict: boolean }> {
  const nextVersion = currentVersion + 1;
  const row = patientProfileToRow(profile, nextVersion);

  // A thrown exception (not just a returned {error}) is treated exactly
  // like a lost CAS race -- retried by the caller's loop, or given up on
  // gracefully after MAX_PERSIST_ATTEMPTS -- rather than propagating and
  // taking refreshPatientProfile down with it.
  try {
    if (currentVersion === 0) {
      const { data, error } = await supabase.from("patient_profiles").insert(row).select().maybeSingle();
      // A unique-constraint violation here means another concurrent refresh already inserted first -- treat identically to a lost CAS race below.
      if (error || !data) return { profile, conflict: true };
      return { profile: parsePatientProfileRow(data as PatientProfileRow), conflict: false };
    }

    const { data, error } = await supabase
      .from("patient_profiles")
      .update(row)
      .eq("clinic_id", profile.clinicId)
      .eq("patient_id", profile.patientId)
      .eq("version", currentVersion)
      .select()
      .maybeSingle();

    if (error || !data) return { profile, conflict: true };
    return { profile: parsePatientProfileRow(data as PatientProfileRow), conflict: false };
  } catch (err) {
    console.error("[ai:patient] failed to persist patient profile", err instanceof Error ? err.message : err);
    return { profile, conflict: true };
  }
}

/**
 * Recomputes and persists a patient's profile from scratch: reliability
 * score, learned communication/scheduling preferences, and a summary
 * (LLM-generated when configured, deterministic rule-based otherwise --
 * see lib/ai/patient/summary.ts). This is the engine's main entry point
 * -- called by the Appointment Lifecycle Engine's store after a
 * patient-relevant transition, and by the orchestrator for a known
 * patient's first turn.
 *
 * Bounded optimistic-concurrency retries (same posture as lib/ai/state/
 * store.ts and lib/ai/appointments/store.ts): on a lost race, reload and
 * recompute once more; if that also loses, return the freshly computed
 * profile unpersisted rather than blocking the caller indefinitely --
 * the next refresh reconciles from whatever version actually landed.
 */
/** Never throws: an unreadable version is treated as 0 (never-persisted), which is always safe -- worst case, a row that does exist causes the subsequent insert to conflict, and the normal retry-into-update path (see persistProfile) handles that exactly like any other lost race. */
async function getCurrentVersion(supabase: SupabaseClient, params: { clinicId: string; patientId: string }): Promise<number> {
  try {
    const { data } = await supabase
      .from("patient_profiles")
      .select("version")
      .eq("clinic_id", params.clinicId)
      .eq("patient_id", params.patientId)
      .maybeSingle();
    return (data as { version: number } | null)?.version ?? 0;
  } catch (err) {
    console.error("[ai:patient] failed to read current profile version, treating as unpersisted", err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function refreshPatientProfile(
  supabase: SupabaseClient,
  params: { clinicId: string; patientId: string },
): Promise<PatientProfile> {
  let lastComputed: PatientProfile | null = null;

  for (let attempt = 1; attempt <= MAX_PERSIST_ATTEMPTS; attempt += 1) {
    const [facts, currentVersion] = await Promise.all([gatherFacts(supabase, params), getCurrentVersion(supabase, params)]);

    const reliability = computeReliabilityScore(facts.outcomes);
    const communication = learnCommunicationPreferences(facts.channels);
    const scheduling = learnSchedulingPreferences(facts.completed);

    const { summary, source } = await generatePatientSummary({
      patientName: facts.patientName,
      reliability,
      communication,
      scheduling,
      recentActivity: facts.recentActivity,
    });

    const computed: PatientProfile = {
      clinicId: params.clinicId,
      patientId: params.patientId,
      reliability,
      communication,
      scheduling,
      summary,
      summarySource: source,
      version: currentVersion,
      lastComputedAt: new Date().toISOString(),
    };
    lastComputed = computed;

    const { profile, conflict } = await persistProfile(supabase, computed, currentVersion);
    if (!conflict) return profile;

    console.warn(`[ai:patient] clinic=${params.clinicId} patient=${params.patientId} persist conflict on attempt ${attempt}, retrying`);
  }

  console.error(`[ai:patient] clinic=${params.clinicId} patient=${params.patientId} giving up on persisting after ${MAX_PERSIST_ATTEMPTS} attempts, using local profile`);
  return lastComputed!;
}
