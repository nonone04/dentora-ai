import type { NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";

/**
 * "Delivering" an in-app notification just means the notification_deliveries
 * row exists -- the staff dashboard/AI Inbox reads deliveries directly
 * rather than through a push mechanism. send() is therefore always a
 * no-op success; there is nothing external to call.
 */
export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = "in_app" as const;

  async send(_message: NotificationMessage): Promise<NotificationResult> {
    return { success: true };
  }
}
