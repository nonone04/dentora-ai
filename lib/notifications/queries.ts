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
