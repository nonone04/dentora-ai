import { getNotificationProvider, type NotificationChannel } from "@/lib/notifications/provider";
import { createClient } from "@/lib/supabase/server";

/** Schedules (but does not dispatch) a reminder for an appointment. */
export async function scheduleAppointmentReminder({
  appointmentId,
  patientId,
  startAt,
  reminderHoursBefore,
  reminderOptIn,
  channel,
}: {
  appointmentId: string;
  patientId: string;
  startAt: Date;
  reminderHoursBefore: number;
  reminderOptIn: boolean;
  channel: NotificationChannel;
}) {
  const supabase = await createClient();
  const scheduledFor = new Date(startAt.getTime() - reminderHoursBefore * 60 * 60 * 1000);

  await supabase.from("notifications").insert({
    appointment_id: appointmentId,
    patient_id: patientId,
    type: "reminder",
    channel,
    status: reminderOptIn ? "pending" : "skipped",
    scheduled_for: scheduledFor.toISOString(),
  });
}

/** Sends (via the current provider) and records a confirmation immediately. */
export async function sendAppointmentConfirmation({
  appointmentId,
  patientId,
  channel,
  to,
  body,
}: {
  appointmentId: string;
  patientId: string;
  channel: NotificationChannel;
  to: string | null;
  body: string;
}) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (!to) {
    await supabase.from("notifications").insert({
      appointment_id: appointmentId,
      patient_id: patientId,
      type: "confirmation",
      channel,
      status: "skipped",
      scheduled_for: now,
      error: "No contact address on file for this channel.",
    });
    return;
  }

  const provider = getNotificationProvider(channel);
  const result = await provider.send({ to, body });

  await supabase.from("notifications").insert({
    appointment_id: appointmentId,
    patient_id: patientId,
    type: "confirmation",
    channel,
    status: result.success ? "sent" : "failed",
    scheduled_for: now,
    sent_at: result.success ? now : null,
    error: result.success ? null : result.error,
  });
}

/** Marks any still-pending reminders for an appointment as skipped (e.g. on cancellation). */
export async function skipPendingReminders(appointmentId: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ status: "skipped" })
    .eq("appointment_id", appointmentId)
    .eq("status", "pending");
}
