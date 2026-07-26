import { logAuditEvent } from "@/lib/audit/log";
import { getNotificationProvider, type NotificationChannel } from "@/lib/notifications/provider";
import { createAdminClient } from "@/lib/supabase/admin";

type DueNotification = {
  id: string;
  type: string;
  channel: NotificationChannel;
  patients: { email: string | null; phone: string | null } | null;
  appointments: { clinic_id: string; start_at: string } | null;
};

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
};

/**
 * Finds due (pending, scheduled_for <= now) notifications across all
 * clinics and dispatches each via the current provider for its channel.
 * Runs cross-tenant by design (that's the whole point of a batch job),
 * so it uses the admin client -- see /api/notifications/process for the
 * secret-protected entry point that's meant to call this.
 */
export async function processDueNotifications(limit = 50): Promise<ProcessResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("notifications")
    .select("id, type, channel, patients(email, phone), appointments(clinic_id, start_at)")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  const notifications = (due ?? []) as unknown as DueNotification[];

  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const appointment = notification.appointments;

    if (!appointment) {
      await supabase
        .from("notifications")
        .update({ status: "failed", error: "Linked appointment no longer exists." })
        .eq("id", notification.id);
      failed += 1;
      continue;
    }

    const to =
      notification.channel === "email"
        ? (notification.patients?.email ?? null)
        : (notification.patients?.phone ?? null);

    let result: { success: true } | { success: false; error: string };
    if (!to) {
      result = { success: false, error: "No contact address on file for this channel." };
    } else {
      const provider = getNotificationProvider(notification.channel);
      result = await provider.send({
        to,
        body: `Reminder: you have an appointment on ${new Date(appointment.start_at).toLocaleString()}.`,
      });
    }

    const sentAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? sentAt : null,
        error: result.success ? null : result.error,
      })
      .eq("id", notification.id);

    await logAuditEvent(supabase, {
      clinicId: appointment.clinic_id,
      actorId: null,
      action: result.success ? "notification_sent" : "notification_failed",
      entityType: "notification",
      entityId: notification.id,
      metadata: { type: notification.type, channel: notification.channel },
    });

    if (result.success) sent += 1;
    else failed += 1;
  }

  return { processed: notifications.length, sent, failed };
}
