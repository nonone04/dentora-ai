import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wipes a real clinic's transactional data: appointments (confirmed and
 * proposed), patients, AI conversations and their processing artifacts,
 * and notifications -- an irreversible "fresh start" for the owner.
 *
 * Deliberately narrower than lib/demo/provision.ts's resetDemoClinicData:
 * dentists, services, clinic_knowledge_records (the AI's knowledge base)
 * and clinic settings are clinic *configuration*, not transactional data,
 * so they're left untouched, matching the Danger Zone spec ("Keep: ...
 * clinic settings"). Guarded to non-demo clinics -- the shared demo clinic
 * has its own reset path (resetDemoClinicData) that reseeds rather than
 * wipes, and must never go through this destructive one.
 *
 * There's no separate "calendar events" or "reports" table in this schema
 * -- appointments *are* the calendar entries (see components/calendar),
 * and dashboard reports (revenue, stats) are computed live from
 * appointments/patients, so deleting those two tables covers both.
 *
 * Runs on the admin (service-role) client, same as resetDemoClinicData --
 * several of the AI-processing tables below (ai_turn_events, ai_decisions,
 * ai_nlu_extractions, ai_availability_queries) have no delete policy for
 * regular clinic members, since they're system-inserted only.
 */
export async function resetClinicData(clinicId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: clinic } = await admin.from("clinics").select("id, is_demo").eq("id", clinicId).maybeSingle();
  if (!clinic) {
    throw new Error("Clinic not found");
  }
  if (clinic.is_demo) {
    throw new Error("Use resetDemoClinicData for the demo clinic");
  }

  // AI processing artifacts reference ai_conversations with ON DELETE SET
  // NULL (not CASCADE), so they must be cleared explicitly by clinic_id
  // rather than relying on the ai_conversations delete below to cascade
  // them away.
  await admin.from("ai_turn_events").delete().eq("clinic_id", clinicId);
  await admin.from("ai_decisions").delete().eq("clinic_id", clinicId);
  await admin.from("ai_nlu_extractions").delete().eq("clinic_id", clinicId);
  await admin.from("ai_availability_queries").delete().eq("clinic_id", clinicId);
  await admin.from("appointment_lifecycle_events").delete().eq("clinic_id", clinicId);
  // notification_deliveries cascades from notification_event_id.
  await admin.from("notification_events").delete().eq("clinic_id", clinicId);
  await admin.from("appointment_drafts").delete().eq("clinic_id", clinicId);
  // ai_messages and conversation_states cascade from conversation_id.
  await admin.from("ai_conversations").delete().eq("clinic_id", clinicId);
  // notifications (appointment_id, patient_id both cascade) and
  // medical_notes/treatments/patient_activity_events/patient_profiles
  // (patient_id cascades) are cleared by the two deletes below.
  await admin.from("appointments").delete().eq("clinic_id", clinicId);
  await admin.from("patients").delete().eq("clinic_id", clinicId);
}
