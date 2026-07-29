import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { formatAppointmentDateTime, type TemplateData } from "@/lib/notifications/templates";
import type { NotificationDeliveryChannel, NotificationEventType } from "@/lib/notifications/types";
import { appointmentCancelledTemplate } from "@/lib/email/templates/appointment-cancelled";
import { appointmentConfirmationTemplate } from "@/lib/email/templates/appointment-confirmation";
import { appointmentReminderTemplate } from "@/lib/email/templates/appointment-reminder";
import { appointmentRescheduledTemplate } from "@/lib/email/templates/appointment-rescheduled";

/**
 * Exactly the 4 appointment lifecycle event types that have a branded
 * HTML template today. `appointment_booked` and `conversation_escalated`
 * are deliberately absent -- they keep sending plain-text-only, unchanged
 * from before this module existed. This Set membership check is the
 * structural guarantee of that, not just a comment.
 */
const HTML_ALLOWLIST: ReadonlySet<NotificationEventType> = new Set([
  "appointment_confirmed",
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
]);

const FALLBACK_PATIENT_NAME: Record<ResponseLanguage, string> = {
  en: "there",
  fr: "",
  ar: "",
};

/**
 * Renders the branded HTML counterpart of an already-computed plain-text
 * notification, for the 4 event types that have one. Returns null for
 * everything else (including channels other than email), so the caller
 * (lib/notifications/dispatch.ts) can pass it straight through as an
 * optional `html` field with no branching of its own.
 */
export function renderNotificationEmailHtml(
  eventType: NotificationEventType,
  channel: NotificationDeliveryChannel,
  language: ResponseLanguage,
  data: TemplateData,
): string | null {
  if (channel !== "email" || !HTML_ALLOWLIST.has(eventType)) return null;

  const patientName = data.patientName ?? FALLBACK_PATIENT_NAME[language];
  const dateTimeFormatted = formatAppointmentDateTime(data.startAt, data.timezone ?? "UTC", language);

  switch (eventType) {
    case "appointment_confirmed":
      return appointmentConfirmationTemplate.render(
        {
          patientName,
          clinicName: data.clinicName,
          clinicEmail: data.clinicEmail,
          dentistName: data.dentistName,
          serviceName: data.serviceName,
          dateTimeFormatted,
        },
        language,
      ).html;

    case "appointment_reminder":
      return appointmentReminderTemplate.render(
        {
          patientName,
          clinicName: data.clinicName,
          clinicEmail: data.clinicEmail,
          dentistName: data.dentistName,
          serviceName: data.serviceName,
          dateTimeFormatted,
        },
        language,
      ).html;

    case "appointment_cancelled":
      return appointmentCancelledTemplate.render(
        {
          patientName,
          clinicName: data.clinicName,
          clinicEmail: data.clinicEmail,
          dateTimeFormatted: dateTimeFormatted || null,
          reason: data.reason,
        },
        language,
      ).html;

    case "appointment_rescheduled":
      return appointmentRescheduledTemplate.render(
        {
          patientName,
          clinicName: data.clinicName,
          clinicEmail: data.clinicEmail,
          dentistName: data.dentistName,
          serviceName: data.serviceName,
          newDateTimeFormatted: dateTimeFormatted,
        },
        language,
      ).html;

    default:
      return null;
  }
}
