"use server";

import { revalidatePath } from "next/cache";
import { refreshPatientProfile, type PatientProfile } from "@/lib/ai/patient";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type RefreshPatientProfileResult = { ok: true; profile: PatientProfile } | { ok: false; message: string };

/**
 * Recomputes and persists a patient's AI profile (reliability score,
 * learned communication/scheduling preferences, summary) on demand --
 * this is the "Refresh AI summary" quick action's server side. Reuses
 * the Patient Intelligence Engine's own refreshPatientProfile
 * (lib/ai/patient/store.ts) exactly as the Appointment Lifecycle Engine
 * and orchestrator already do; nothing about that engine changes here.
 * Same minimal auth posture as app/actions/medical-records.ts's sibling
 * actions -- requireUser() only, RLS on patient_profiles (any active
 * clinic member may insert/update) is the actual scoping backstop.
 */
export async function refreshPatientProfileAction(clinicId: string, patientId: string): Promise<RefreshPatientProfileResult> {
  await requireUser();
  const supabase = await createClient();
  const t = await getServerDictionary();

  try {
    const profile = await refreshPatientProfile(supabase, { clinicId, patientId });
    revalidatePath(`/clinic/${clinicId}/patients/${patientId}`);
    return { ok: true, profile };
  } catch (err) {
    console.error("[patient-workspace] failed to refresh patient profile", err instanceof Error ? err.message : err);
    return { ok: false, message: t.patientDetail.aiSummary.refreshError };
  }
}
