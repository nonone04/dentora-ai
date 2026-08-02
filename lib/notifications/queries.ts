import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryForEventType, type NotificationCategory } from "@/lib/notifications/categories";
import type { NotificationDeliveryChannel, NotificationDeliveryStatus, NotificationEventType } from "@/lib/notifications/types";

export type NotificationCenterItem = {
  id: string;
  status: NotificationDeliveryStatus;
  channel: NotificationDeliveryChannel;
  createdAt: string;
  eventType: NotificationEventType | null;
  category: NotificationCategory | null;
  archivedAt: string | null;
};

type DeliveryRow = {
  id: string;
  status: NotificationDeliveryStatus;
  channel: NotificationDeliveryChannel;
  created_at: string;
  archived_at: string | null;
  notification_events: { type: NotificationEventType } | null;
};

function parseRow(row: DeliveryRow): NotificationCenterItem {
  const eventType = row.notification_events?.type ?? null;
  return {
    id: row.id,
    status: row.status,
    channel: row.channel,
    createdAt: row.created_at,
    eventType,
    category: categoryForEventType(eventType),
    archivedAt: row.archived_at,
  };
}

/**
 * Shared read path for both the dashboard's compact "last N" widget
 * (components/dashboard/notification-center.tsx, no channel/category
 * filter, small limit -- preserves its existing all-channel behavior
 * exactly) and the header bell panel (components/clinic/notification-bell.tsx,
 * channel: "in_app", optional category tab, larger limit). Returns null
 * on failure so callers can distinguish "no data yet" from "query failed".
 */
export async function listNotificationCenterItems(
  supabase: SupabaseClient,
  params: { clinicId: string; channel?: NotificationDeliveryChannel; category?: NotificationCategory; includeArchived?: boolean; limit?: number },
): Promise<NotificationCenterItem[] | null> {
  let query = supabase
    .from("notification_deliveries")
    .select("id, status, channel, created_at, archived_at, notification_events(type)")
    .eq("clinic_id", params.clinicId);

  if (params.channel) query = query.eq("channel", params.channel);
  if (!params.includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(params.limit ?? 20);
  if (error) return null;

  const items = ((data ?? []) as unknown as DeliveryRow[]).map(parseRow);
  return params.category ? items.filter((item) => item.category === params.category) : items;
}

export type PatientNotificationDeliveryItem = {
  id: string;
  eventType: NotificationEventType | null;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  scheduledFor: string;
  sentAt: string | null;
};

type PatientDeliveryRow = {
  id: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  scheduled_for: string;
  sent_at: string | null;
  notification_events: { type: NotificationEventType } | null;
};

/**
 * Per-patient delivery history for the patient detail page's
 * Notifications card (components/patients/notifications-section.tsx) --
 * the read-side counterpart of the write consolidation in
 * app/actions/appointments.ts/appointment-drafts.ts: every booking path
 * now creates notification_deliveries rows (never the legacy
 * `notifications` table), so this is the one place that patient-scoped
 * history lives, alongside listCommunicationHistory's clinic-wide view.
 */
export async function listPatientNotificationDeliveries(
  supabase: SupabaseClient,
  params: { clinicId: string; patientId: string; limit?: number },
): Promise<PatientNotificationDeliveryItem[] | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, channel, status, scheduled_for, sent_at, notification_events(type)")
    .eq("clinic_id", params.clinicId)
    .eq("recipient_patient_id", params.patientId)
    .order("scheduled_for", { ascending: false })
    .limit(params.limit ?? 20);

  if (error) return null;

  return ((data ?? []) as unknown as PatientDeliveryRow[]).map((row) => ({
    id: row.id,
    eventType: row.notification_events?.type ?? null,
    channel: row.channel,
    status: row.status,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
  }));
}

export type AppointmentWhatsAppStatus = {
  eventType: NotificationEventType | null;
  status: NotificationDeliveryStatus;
  scheduledFor: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  lastError: string | null;
};

type AppointmentDeliveryRow = {
  status: NotificationDeliveryStatus;
  scheduled_for: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  last_error: string | null;
  notification_events: { type: NotificationEventType; appointment_id: string | null } | null;
};

/**
 * The most recent whatsapp-channel delivery tied to one appointment --
 * backs the Appointment Details dashboard's WhatsApp panel (Last
 * message / Status / Delivered / Read / Failed). Joins through
 * notification_events since notification_deliveries itself has no
 * appointment_id column (it's denormalized onto the event, not the
 * delivery -- see the notification_platform migration).
 */
export async function getLatestWhatsAppDeliveryForAppointment(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId: string },
): Promise<AppointmentWhatsAppStatus | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("status, scheduled_for, sent_at, delivered_at, read_at, last_error, notification_events!inner(type, appointment_id)")
    .eq("clinic_id", params.clinicId)
    .eq("channel", "whatsapp")
    .eq("notification_events.appointment_id", params.appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as AppointmentDeliveryRow;
  return {
    eventType: row.notification_events?.type ?? null,
    status: row.status,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    lastError: row.last_error,
  };
}

/**
 * The "Response" column's content, not the patient's typed reply --
 * that content lives in ai_conversations (a separate feature this
 * doesn't join against). A tagged shape rather than a single ambiguous
 * string, so the UI formats a timestamp as a date and an error as plain
 * text instead of having to guess which one it received.
 */
export type CommunicationHistoryResponse = { kind: "timestamp"; value: string } | { kind: "error"; value: string } | null;

export type CommunicationHistoryItem = {
  id: string;
  createdAt: string;
  patientName: string | null;
  eventType: NotificationEventType | null;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  response: CommunicationHistoryResponse;
};

type CommunicationHistoryRow = {
  id: string;
  created_at: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  delivered_at: string | null;
  read_at: string | null;
  last_error: string | null;
  patients: { full_name: string } | null;
  notification_events: { type: NotificationEventType } | null;
};

/**
 * Clinic-wide delivery log for the Communication History page
 * (/clinic/[clinicId]/communications) -- every channel, every patient,
 * newest first. Distinct from listNotificationCenterItems (that one
 * backs the in-app bell/dashboard widget, in_app-channel-only by
 * default) and from listPatientNotificationDeliveries (that one is
 * scoped to a single patient) -- this is the all-up audit view.
 */
export async function listCommunicationHistory(
  supabase: SupabaseClient,
  params: { clinicId: string; limit?: number },
): Promise<CommunicationHistoryItem[] | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, created_at, channel, status, delivered_at, read_at, last_error, patients(full_name), notification_events(type)")
    .eq("clinic_id", params.clinicId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);

  if (error) return null;

  return ((data ?? []) as unknown as CommunicationHistoryRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    patientName: row.patients?.full_name ?? null,
    eventType: row.notification_events?.type ?? null,
    channel: row.channel,
    status: row.status,
    response:
      row.status === "read" && row.read_at
        ? { kind: "timestamp" as const, value: row.read_at }
        : row.status === "delivered" && row.delivered_at
          ? { kind: "timestamp" as const, value: row.delivered_at }
          : row.status === "failed" && row.last_error
            ? { kind: "error" as const, value: row.last_error }
            : null,
  }));
}

/** Unread count for the bell badge -- clinic-wide, not per-user, since staff in-app deliveries have no per-user recipient id today. See docs/customer-communications.md. */
export async function countUnreadNotifications(supabase: SupabaseClient, clinicId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("channel", "in_app")
    .in("status", ["sent", "delivered"])
    .is("archived_at", null);

  if (error) return null;
  return count ?? 0;
}
