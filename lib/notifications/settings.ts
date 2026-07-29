export const DEFAULT_REMINDER_HOURS_BEFORE = 24;

export type ClinicNotificationSettings = {
  reminderHoursBefore?: number;
  sendConfirmations?: boolean;
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
