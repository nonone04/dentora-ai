"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { scheduleAppointmentReminder } from "@/lib/notifications/schedule";
import { DEFAULT_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type DraftActionState = { error?: string } | undefined;

export async function approveDraft(
  clinicId: string,
  draftId: string,
  _prevState: DraftActionState,
  _formData: FormData,
): Promise<DraftActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: draft, error: draftError } = await supabase
    .from("appointment_drafts")
    .select(
      "id, patient_id, patient_name, patient_phone, dentist_id, service_id, proposed_start_at, proposed_end_at, notes, status",
    )
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (draftError || !draft) {
    return { error: "Draft not found." };
  }
  if (draft.status !== "proposed") {
    return { error: "This draft has already been reviewed." };
  }

  // Resolve a real patient: use the linked one if present, else try to
  // match an existing patient by phone (a returning caller might already
  // be a patient just not linked to this draft), else create one.
  let patientId = draft.patient_id as string | null;

  if (!patientId && draft.patient_phone) {
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", draft.patient_phone)
      .maybeSingle();
    if (existingPatient) {
      patientId = existingPatient.id;
    }
  }

  if (!patientId) {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({
        clinic_id: clinicId,
        full_name: draft.patient_name?.trim() || "Unknown patient",
        phone: draft.patient_phone,
        created_via: "ai_assistant",
      })
      .select("id")
      .single();

    if (patientError) {
      return { error: patientError.message };
    }
    patientId = newPatient.id;
  }
  if (!patientId) {
    return { error: "Could not resolve a patient for this draft." };
  }
  const resolvedPatientId: string = patientId;

  // The DB's exclusion constraint is the real double-booking guard here
  // (not the draft tool's earlier application-level check from Phase
  // 12A) -- real time has passed since the draft was proposed.
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: resolvedPatientId,
      dentist_id: draft.dentist_id,
      service_id: draft.service_id,
      start_at: draft.proposed_start_at,
      end_at: draft.proposed_end_at,
      notes: draft.notes,
      source: "ai_assistant",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (appointmentError) {
    if (appointmentError.code === "23P01") {
      return {
        error: "This dentist now has a conflicting appointment. Reject this draft or propose a new time.",
      };
    }
    return { error: appointmentError.message };
  }

  const { error: updateError } = await supabase
    .from("appointment_drafts")
    .update({ status: "confirmed" })
    .eq("id", draftId)
    .eq("status", "proposed");

  if (updateError) {
    return { error: updateError.message };
  }

  const [{ data: patient }, { data: clinic }] = await Promise.all([
    supabase
      .from("patients")
      .select("reminder_opt_in, preferred_contact_channel")
      .eq("id", resolvedPatientId)
      .single(),
    supabase.from("clinics").select("settings").eq("id", clinicId).single(),
  ]);

  const notificationSettings = getClinicNotificationSettings(clinic?.settings ?? null);

  // Same notification path createAppointment already uses -- nothing new.
  await scheduleAppointmentReminder({
    appointmentId: appointment.id,
    patientId: resolvedPatientId,
    startAt: new Date(draft.proposed_start_at),
    reminderHoursBefore: notificationSettings.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    reminderOptIn: patient?.reminder_opt_in ?? true,
    channel: patient?.preferred_contact_channel ?? "email",
  });

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "appointment_draft_approved",
    entityType: "appointment_draft",
    entityId: draftId,
    metadata: { appointmentId: appointment.id, patientId: resolvedPatientId },
  });

  revalidatePath(`/clinic/${clinicId}/ai-inbox`);
  revalidatePath(`/clinic/${clinicId}/appointments`);
  return undefined;
}

export async function rejectDraft(
  clinicId: string,
  draftId: string,
  _prevState: DraftActionState,
  _formData: FormData,
): Promise<DraftActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("appointment_drafts")
    .update({ status: "rejected" })
    .eq("id", draftId)
    .eq("clinic_id", clinicId)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!updated) {
    return { error: "This draft has already been reviewed." };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "appointment_draft_rejected",
    entityType: "appointment_draft",
    entityId: draftId,
  });

  revalidatePath(`/clinic/${clinicId}/ai-inbox`);
  return undefined;
}
