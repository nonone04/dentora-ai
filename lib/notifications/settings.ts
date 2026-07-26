export const DEFAULT_REMINDER_HOURS_BEFORE = 24;

export type ClinicNotificationSettings = {
  reminderHoursBefore?: number;
  sendConfirmations?: boolean;
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
