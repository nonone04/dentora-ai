"use server";

import { revalidatePath } from "next/cache";
import { transitionAppointment, type LifecycleEventType } from "@/lib/ai/appointments";
import { logAuditEvent } from "@/lib/audit/log";
import { getServerDictionary } from "@/lib/i18n/server";
import { scheduleAppointmentReminders } from "@/lib/notifications";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type CreateAppointmentFormState = { error?: string; success?: boolean } | undefined;
export type UpdateStatusFormState = { error?: string } | undefined;

const VALID_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

/**
 * Maps a dashboard status button to the Appointment Lifecycle Engine's
 * own event vocabulary (lib/ai/appointments) -- the same FSM every AI-
 * initiated transition already goes through (lib/ai/tools/*), so a
 * staff-driven status change now gets identical audit-trail, optimistic-
 * concurrency, and notification-hook coverage. "scheduled" has no
 * corresponding forward transition (nothing reverts an appointment back
 * to its initial state), so it's deliberately absent here.
 */
const LIFECYCLE_EVENT_BY_STATUS: Partial<Record<string, LifecycleEventType>> = {
  confirmed: "confirm",
  cancelled: "cancel",
  completed: "complete",
  no_show: "mark_no_show",
};

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

  const t = await getServerDictionary();

  if (typeof patientId !== "string" || !patientId) {
    return { error: t.validation.patientRequired };
  }
  if (typeof dentistId !== "string" || !dentistId) {
    return { error: t.validation.dentistRequired };
  }
  if (typeof startAt !== "string" || !startAt) {
    return { error: t.validation.startTimeRequired };
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return { error: t.validation.startTimeInvalid };
  }

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: t.validation.durationPositive };
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
      return { error: t.validation.dentistDoubleBooked };
    }
    return { error: error.message };
  }

  // reminderOptIn / channel / hours-before are all resolved from the patient +
  // clinic settings inside scheduleAppointmentReminders itself (via
  // loadNotificationContext) -- no separate fetch needed here anymore.
  await scheduleAppointmentReminders(supabase, { clinicId, appointmentId: appointment.id, patientId });

  await track({ name: "Appointment Created", userId: user.id, clinicId, properties: { source: "staff" } });

  revalidatePath(`/clinic/${clinicId}/appointments`);
  return { success: true };
}

/**
 * Every staff-driven status change now goes through the same
 * Appointment Lifecycle Engine transition (lib/ai/appointments) that
 * app/actions/calendar.ts's rescheduleAppointmentAction already uses --
 * confirmation/cancellation/completion notifications (and reminder
 * scheduling/skipping) all follow automatically from
 * applyNotificationHook there, so this action no longer talks to the
 * Notification & Communication Platform directly.
 */
export async function updateAppointmentStatus(
  clinicId: string,
  appointmentId: string,
  _prevState: UpdateStatusFormState,
  formData: FormData,
): Promise<UpdateStatusFormState> {
  const user = await requireUser();
  const t = await getServerDictionary();

  const status = formData.get("status");
  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return { error: t.validation.invalidStatus };
  }

  const event = LIFECYCLE_EVENT_BY_STATUS[status];
  if (!event) {
    return { error: t.validation.invalidStatus };
  }

  const supabase = await createClient();
  const outcome = await transitionAppointment(supabase, { clinicId, appointmentId, event, actor: "staff", actorId: user.id });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") return { error: t.calendar.conflict.notFound };
    if (outcome.reason === "conflict") return { error: t.calendar.conflict.raceLost };
    return { error: outcome.message };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "appointment_status_changed",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { from: outcome.fromStatus, to: outcome.toStatus },
  });
  await track({ name: "Appointment Updated", userId: user.id, clinicId, properties: { status } });
  if (status === "cancelled") {
    await track({ name: "Appointment Cancelled", userId: user.id, clinicId });
  }

  revalidatePath(`/clinic/${clinicId}/appointments`);
  return undefined;
}
