import type { NotificationEventType } from "@/lib/notifications/types";

/**
 * In-app Notification Center categories. Unrelated to lib/email/types.ts's
 * EmailCategory (that one groups the preview-page's template catalog;
 * this one groups notification_deliveries rows for the bell panel).
 *
 * "security"/"team"/"system" have no event type feeding them today --
 * the pipeline only ever logs appointment/AI events (see
 * EVENT_TYPE_TO_CATEGORY below). Those tabs render an honest empty state
 * in the UI rather than fabricated rows. See docs/customer-communications.md.
 */
export const NOTIFICATION_CATEGORIES = ["appointments", "security", "ai", "team", "system"] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const EVENT_TYPE_TO_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  appointment_booked: "appointments",
  appointment_confirmed: "appointments",
  appointment_cancelled: "appointments",
  appointment_rescheduled: "appointments",
  appointment_reminder: "appointments",
  appointment_completed: "appointments",
  custom_message: "appointments",
  conversation_escalated: "ai",
};

export function categoryForEventType(eventType: NotificationEventType | null | undefined): NotificationCategory | null {
  if (!eventType) return null;
  return EVENT_TYPE_TO_CATEGORY[eventType] ?? null;
}
