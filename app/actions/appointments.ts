"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import {
  scheduleAppointmentReminder,
  sendAppointmentConfirmation,
  skipPendingReminders,
} from "@/lib/notifications/schedule";
import { DEFAULT_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type CreateAppointmentFormState = { error?: string; success?: boolean } | undefined;
export type UpdateStatusFormState = { error?: string } | undefined;

const VALID_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

export async function createAppointment(
  clinicId: string,
  _prevState: CreateAppointmentFormState,
  formData: FormData,
): Promise<CreateAppointmentFormState> {
  const user = await requireUser();

  const patientId = formData.get("patientId");
  const dentistId = formData.get("dentistId");
  const serviceId = formData.get("serviceId");
  const startAt = formData.get("startAt");
  const durationMinutes = formData.get("durationMinutes");
  const notes = formData.get("notes");

  if (typeof patientId !== "string" || !patientId) {
    return { error: "Patient is required." };
  }
  if (typeof dentistId !== "string" || !dentistId) {
    return { error: "Dentist is required." };
  }
  if (typeof startAt !== "string" || !startAt) {
    return { error: "Start time is required." };
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return { error: "Start time is invalid." };
  }

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Duration must be a positive number of minutes." };
  }

  const end = new Date(start.getTime() + duration * 60_000);

  const supabase = await createClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      dentist_id: dentistId,
      service_id: typeof serviceId === "string" && serviceId ? serviceId : null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return { error: "This dentist already has an appointment at that time." };
    }
    return { error: error.message };
  }

  const [{ data: patient }, { data: clinic }] = await Promise.all([
    supabase
      .from("patients")
      .select("reminder_opt_in, preferred_contact_channel")
      .eq("id", patientId)
      .single(),
    supabase.from("clinics").select("settings").eq("id", clinicId).single(),
  ]);

  const notificationSettings = getClinicNotificationSettings(clinic?.settings ?? null);

  await scheduleAppointmentReminder({
    appointmentId: appointment.id,
    patientId,
    startAt: start,
    reminderHoursBefore: notificationSettings.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    reminderOptIn: patient?.reminder_opt_in ?? true,
    channel: patient?.preferred_contact_channel ?? "email",
  });

  revalidatePath(`/clinic/${clinicId}/appointments`);
  return { success: true };
}

export async function updateAppointmentStatus(
  clinicId: string,
  appointmentId: string,
  _prevState: UpdateStatusFormState,
  formData: FormData,
): Promise<UpdateStatusFormState> {
  const user = await requireUser();

  const status = formData.get("status");
  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .single();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .select("id, patient_id, start_at, patients(email, phone, preferred_contact_channel)")
    .single();

  if (error) {
    return { error: error.message };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "appointment_status_changed",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { from: previous?.status ?? null, to: status },
  });

  if (status === "cancelled") {
    await skipPendingReminders(appointmentId);
  }

  if (status === "confirmed") {
    const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId).single();
    const notificationSettings = getClinicNotificationSettings(clinic?.settings ?? null);

    if (notificationSettings.sendConfirmations ?? true) {
      const patient = appointment.patients as unknown as {
        email: string | null;
        phone: string | null;
        preferred_contact_channel: "email" | "sms" | "whatsapp";
      } | null;
      const channel = patient?.preferred_contact_channel ?? "email";
      const to = channel === "email" ? (patient?.email ?? null) : (patient?.phone ?? null);

      await sendAppointmentConfirmation({
        appointmentId,
        patientId: appointment.patient_id,
        channel,
        to,
        body: `Your appointment on ${new Date(appointment.start_at).toLocaleString()} has been confirmed.`,
      });
    }
  }

  revalidatePath(`/clinic/${clinicId}/appointments`);
  return undefined;
}
