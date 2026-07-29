import type { SupabaseClient } from "@supabase/supabase-js";
import { loadNotificationContext } from "@/lib/notifications/context";
import { renderNotificationEmailHtml } from "@/lib/notifications/email-html";
import { getNotificationProvider } from "@/lib/notifications/provider";
import { computeNextAttemptAt, shouldRetry } from "@/lib/notifications/retry";
import { applyDeliveryEvent, listDueDeliveries, loadDelivery } from "@/lib/notifications/store";
import { renderNotificationTemplate } from "@/lib/notifications/templates";
import type { NotificationDelivery, NotificationEventType } from "@/lib/notifications/types";

type NotificationEventRow = {
  id: string;
  clinic_id: string;
  type: NotificationEventType;
  appointment_id: string | null;
  appointment_draft_id: string | null;
  patient_id: string | null;
  metadata: Record<string, unknown>;
};

async function loadEvent(supabase: SupabaseClient, id: string): Promise<NotificationEventRow | null> {
  const { data, error } = await supabase.from("notification_events").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as NotificationEventRow;
}

export type SendDeliveryResult = { ok: true; delivery: NotificationDelivery } | { ok: false; reason: string };

async function failOrRetry(supabase: SupabaseClient, delivery: NotificationDelivery, errorMessage: string): Promise<SendDeliveryResult> {
  const retry = shouldRetry(delivery.attempts, delivery.maxAttempts);
  const nextAttemptAt = computeNextAttemptAt(delivery.attempts).toISOString();

  const outcome = await applyDeliveryEvent(supabase, {
    clinicId: delivery.clinicId,
    id: delivery.id,
    event: retry ? "retry" : "exhaust",
    patch: retry
      ? { last_error: errorMessage, next_attempt_at: nextAttemptAt, scheduled_for: nextAttemptAt }
      : { last_error: errorMessage },
  });

  if (!outcome.ok) return { ok: false, reason: outcome.reason };
  return { ok: false, reason: errorMessage };
}

/**
 * Sends (or schedules a retry for) a single due delivery: re-renders its
 * template from fresh context (so a since-updated appointment time is
 * reflected even on a retry), calls the channel's provider, and applies
 * the resulting delivery-status-machine event. Re-fetches the linked
 * notification_event and context at send time rather than trusting
 * anything cached on the delivery row itself, other than the
 * recipientAddress/channel/language it was created with.
 */
export async function sendDelivery(supabase: SupabaseClient, delivery: NotificationDelivery): Promise<SendDeliveryResult> {
  const started = await applyDeliveryEvent(supabase, {
    clinicId: delivery.clinicId,
    id: delivery.id,
    event: "start_send",
    patch: { attempts: delivery.attempts + 1 },
  });
  if (!started.ok) return { ok: false, reason: started.reason };
  const current = started.delivery;

  const event = await loadEvent(supabase, current.notificationEventId);
  if (!event) return failOrRetry(supabase, current, "Linked notification event no longer exists.");

  const context = await loadNotificationContext(supabase, {
    clinicId: current.clinicId,
    appointmentId: event.appointment_id,
    appointmentDraftId: event.appointment_draft_id,
    patientId: event.patient_id,
  });

  if (!context) return failOrRetry(supabase, current, "Clinic context could not be resolved.");
  if (!current.recipientAddress) return failOrRetry(supabase, current, "No contact address on file for this channel.");

  const templateData = {
    clinicName: context.clinicName,
    clinicEmail: context.clinicEmail,
    patientName: context.patient?.name ?? null,
    dentistName: context.appointment?.dentistName ?? null,
    serviceName: context.appointment?.serviceName ?? null,
    startAt: context.appointment?.startAt ?? null,
    timezone: context.timezone,
    reason: typeof event.metadata?.reason === "string" ? (event.metadata.reason as string) : null,
  };

  const rendered = renderNotificationTemplate(event.type, current.channel, current.language, templateData);
  const html = renderNotificationEmailHtml(event.type, current.channel, current.language, templateData);

  const result = await getNotificationProvider(current.channel).send({
    to: current.recipientAddress,
    subject: rendered.subject ?? undefined,
    body: rendered.body,
    html: html ?? undefined,
  });

  if (!result.success) return failOrRetry(supabase, current, result.error);

  const succeeded = await applyDeliveryEvent(supabase, {
    clinicId: current.clinicId,
    id: current.id,
    event: "send_succeeded",
    patch: { sent_at: new Date().toISOString(), last_error: null },
  });
  if (!succeeded.ok) return { ok: false, reason: succeeded.reason };
  return { ok: true, delivery: succeeded.delivery };
}

export type ProcessDeliveriesResult = { processed: number; sent: number; retried: number; failed: number };

/**
 * Finds due (pending, scheduled_for <= now) deliveries across all
 * clinics and sends each -- the batch entry point for
 * /api/notifications/dispatch, the new pipeline's counterpart to
 * lib/notifications/process.ts's processDueNotifications for the
 * original `notifications` table. Runs cross-tenant by design, so it's
 * meant to be called with the admin client. Each delivery's failure is
 * isolated (logged, counted) so one bad row never stops the batch.
 */
export async function processDueNotificationDeliveries(
  supabase: SupabaseClient,
  params: { limit?: number } = {},
): Promise<ProcessDeliveriesResult> {
  const due = await listDueDeliveries(supabase, { limit: params.limit });

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const delivery of due) {
    try {
      const result = await sendDelivery(supabase, delivery);
      if (result.ok) {
        sent += 1;
        continue;
      }
      const reloaded = await loadDelivery(supabase, { clinicId: delivery.clinicId, id: delivery.id });
      if (reloaded?.status === "pending") retried += 1;
      else failed += 1;
    } catch (err) {
      console.error("[notifications] dispatch failed for delivery", delivery.id, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  return { processed: due.length, sent, retried, failed };
}
