export const DEFAULT_REMINDER_HOURS_BEFORE = 24;
export const DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE = 2;

export type ClinicNotificationSettings = {
  reminderHoursBefore?: number;
  /**
   * A second, closer-to-the-visit reminder (e.g. "2 hours before"),
   * alongside the primary reminderHoursBefore one. Defaults to
   * DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE when unset (backward
   * compatible: every clinic gets the second reminder unless it
   * explicitly opts out); set to `null` to send only the one reminder.
   */
  secondaryReminderHoursBefore?: number | null;
  sendConfirmations?: boolean;
  /** Google Business review link, used by the appointment_completed message's review-request line. Omitted from the message entirely when unset -- see lib/notifications/templates.ts / lib/whatsapp/templates.ts. */
  googleReviewUrl?: string | null;
  /** Per-channel kill switches -- default true (unset = enabled), consumed by engine.ts's buildDeliveryPlans. */
  channels?: {
    email?: boolean;
    inApp?: boolean;
  };
  /**
   * Per-category toggles. `appointmentReminders` and `aiSummaries` gate
   * real event types (appointment_reminder, conversation_escalated).
   * `securityAlerts`/`teamActivity` are stored/toggleable but currently
   * UI-only ("coming soon") -- no security or team-activity event type
   * exists in the pipeline yet. See docs/customer-communications.md.
   */
  categories?: {
    appointmentReminders?: boolean;
    securityAlerts?: boolean;
    aiSummaries?: boolean;
    teamActivity?: boolean;
  };
};

export function getClinicNotificationSettings(
  clinicSettings: Record<string, unknown> | null | undefined,
): ClinicNotificationSettings {
  const notifications = clinicSettings?.notifications;
  if (notifications && typeof notifications === "object") {
    return notifications as ClinicNotificationSettings;
  }
  return {};
}
