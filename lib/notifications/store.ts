import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { transitionDelivery, type DeliveryEvent } from "@/lib/notifications/machine";
import { DEFAULT_MAX_ATTEMPTS } from "@/lib/notifications/retry";
import {
  parseNotificationDeliveryRow,
  type NotificationDelivery,
  type NotificationDeliveryChannel,
  type NotificationDeliveryRow,
  type NotificationRecipientType,
} from "@/lib/notifications/types";

const MAX_PERSIST_ATTEMPTS = 2;

export type CreateDeliveryParams = {
  clinicId: string;
  notificationEventId: string;
  recipientType: NotificationRecipientType;
  recipientPatientId?: string | null;
  recipientAddress: string | null;
  channel: NotificationDeliveryChannel;
  templateKey: string;
  language: ResponseLanguage;
  /** ISO datetime; defaults to now (send as soon as the dispatcher picks it up). */
  scheduledFor?: string;
  maxAttempts?: number;
};

export async function createDelivery(supabase: SupabaseClient, params: CreateDeliveryParams): Promise<NotificationDelivery | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      clinic_id: params.clinicId,
      notification_event_id: params.notificationEventId,
      recipient_type: params.recipientType,
      recipient_patient_id: params.recipientPatientId ?? null,
      recipient_address: params.recipientAddress,
      channel: params.channel,
      template_key: params.templateKey,
      language: params.language,
      scheduled_for: params.scheduledFor ?? new Date().toISOString(),
      max_attempts: params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error("[notifications] failed to create delivery", error?.message);
    return null;
  }
  return parseNotificationDeliveryRow(data as NotificationDeliveryRow);
}

export async function loadDelivery(supabase: SupabaseClient, params: { clinicId: string; id: string }): Promise<NotificationDelivery | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("*")
    .eq("id", params.id)
    .eq("clinic_id", params.clinicId)
    .maybeSingle();
  if (error || !data) return null;
  return parseNotificationDeliveryRow(data as NotificationDeliveryRow);
}

export type ApplyDeliveryEventOutcome =
  | { ok: true; delivery: NotificationDelivery }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; message: string }
  | { ok: false; reason: "conflict" };

/**
 * Applies one delivery-status-machine event via compare-and-swap on
 * `version`, with an extra `patch` of columns to set alongside the
 * status change (attempts/last_error/next_attempt_at/sent_at/...).
 * Same bounded-retry-on-lost-race posture as lib/ai/appointments/
 * store.ts and lib/ai/patient/store.ts: reload and re-validate once on a
 * lost race before giving up.
 */
export async function applyDeliveryEvent(
  supabase: SupabaseClient,
  params: { clinicId: string; id: string; event: DeliveryEvent; patch?: Record<string, unknown> },
): Promise<ApplyDeliveryEventOutcome> {
  for (let attempt = 1; attempt <= MAX_PERSIST_ATTEMPTS; attempt += 1) {
    const { data: row, error } = await supabase
      .from("notification_deliveries")
      .select("*")
      .eq("id", params.id)
      .eq("clinic_id", params.clinicId)
      .maybeSingle();

    if (error || !row) return { ok: false, reason: "not_found" };

    const current = parseNotificationDeliveryRow(row as NotificationDeliveryRow);
    const result = transitionDelivery(current.status, params.event);
    if (!result.ok) return { ok: false, reason: "invalid_transition", message: result.message };

    const { data: updated, error: updateError } = await supabase
      .from("notification_deliveries")
      .update({ status: result.toStatus, version: current.version + 1, ...(params.patch ?? {}) })
      .eq("id", params.id)
      .eq("version", current.version)
      .select()
      .maybeSingle();

    if (updateError) return { ok: false, reason: "invalid_transition", message: updateError.message };
    if (!updated) {
      if (attempt < MAX_PERSIST_ATTEMPTS) continue;
      return { ok: false, reason: "conflict" };
    }

    return { ok: true, delivery: parseNotificationDeliveryRow(updated as NotificationDeliveryRow) };
  }

  return { ok: false, reason: "conflict" };
}

/** Cross-tenant: status='pending' and due -- the dispatcher's batch entry point (lib/notifications/dispatch.ts), meant to be called via the admin client. */
export async function listDueDeliveries(supabase: SupabaseClient, params: { limit?: number } = {}): Promise<NotificationDelivery[]> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(params.limit ?? 50);

  if (error || !data) return [];
  return (data as NotificationDeliveryRow[]).map(parseNotificationDeliveryRow);
}

/**
 * Archives a delivery for the in-app Notification Center -- a plain,
 * one-directional column write (no unarchive), deliberately bypassing
 * the delivery-status FSM in machine.ts since archived-vs-not is a
 * visibility concern orthogonal to delivery status. Idempotent: archiving
 * an already-archived row is a no-op (the `is("archived_at", null)`
 * guard just means the second call touches zero rows, still returns true).
 */
export async function archiveDelivery(supabase: SupabaseClient, params: { clinicId: string; id: string }): Promise<boolean> {
  const { error } = await supabase
    .from("notification_deliveries")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("clinic_id", params.clinicId)
    .is("archived_at", null);

  return !error;
}

/**
 * Marks every still-pending delivery tied to an appointment as skipped
 * (via the machine's "skip" event) -- used when an appointment is
 * cancelled/rescheduled so a stale reminder never goes out. Best-effort:
 * a failure to skip one delivery is logged and doesn't stop the rest,
 * and never propagates to the caller (a lifecycle transition that has
 * already succeeded).
 */
export async function skipPendingDeliveriesForAppointment(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId: string; reason: string },
): Promise<void> {
  const { data: events } = await supabase
    .from("notification_events")
    .select("id")
    .eq("clinic_id", params.clinicId)
    .eq("appointment_id", params.appointmentId);
  const eventIds = ((events as { id: string }[] | null) ?? []).map((e) => e.id);
  if (eventIds.length === 0) return;

  const { data: pending } = await supabase
    .from("notification_deliveries")
    .select("id")
    .eq("clinic_id", params.clinicId)
    .eq("status", "pending")
    .in("notification_event_id", eventIds);

  for (const row of ((pending as { id: string }[] | null) ?? [])) {
    const outcome = await applyDeliveryEvent(supabase, {
      clinicId: params.clinicId,
      id: row.id,
      event: "skip",
      patch: { last_error: params.reason },
    });
    if (!outcome.ok) console.error("[notifications] failed to skip pending delivery", row.id, outcome.reason);
  }
}
