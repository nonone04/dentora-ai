import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientActivityEvent } from "@/lib/ai/patient/types";

/**
 * Appends one row to the immutable patient_activity_events timeline.
 * Takes a generic SupabaseClient (not specifically the admin client --
 * same convention as lib/ai/appointments/audit.ts) since this is called
 * both from the AI orchestrator's admin client and, via the Appointment
 * Lifecycle Engine's store, potentially from a real staff session too.
 * Best-effort: a logging failure must never affect the caller's own
 * success/failure.
 */
export async function recordPatientActivity(supabase: SupabaseClient, event: PatientActivityEvent) {
  console.log(`[ai:patient] clinic=${event.clinicId} patient=${event.patientId} activity=${event.type}`);

  const { error } = await supabase.from("patient_activity_events").insert({
    clinic_id: event.clinicId,
    patient_id: event.patientId,
    type: event.type,
    appointment_id: event.appointmentId ?? null,
    conversation_id: event.conversationId ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) console.error("[ai:patient] failed to record patient activity", error.message);
}
