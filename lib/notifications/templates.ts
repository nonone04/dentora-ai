import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import type { NotificationDeliveryChannel, NotificationEventType } from "@/lib/notifications/types";

export type TemplateData = {
  clinicName: string;
  clinicEmail?: string | null;
  patientName?: string | null;
  dentistName?: string | null;
  serviceName?: string | null;
  startAt?: string | null;
  timezone?: string;
  reason?: string | null;
};

export type RenderedTemplate = { subject: string | null; body: string };

const LOCALE_BY_LANGUAGE: Record<ResponseLanguage, string> = { en: "en-US", fr: "fr-FR", ar: "ar-MA" };

/** Deterministic, given a fixed Date/timezone/language -- fully unit-testable without mocking the system clock. */
export function formatAppointmentDateTime(iso: string | null | undefined, timezone: string, language: ResponseLanguage): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

type TemplateBuilder = (data: TemplateData, formattedDate: string) => { subject: string; body: string };

const TEMPLATES: Record<NotificationEventType, Record<ResponseLanguage, TemplateBuilder>> = {
  appointment_booked: {
    en: (data, date) => ({
      subject: `New appointment request${data.clinicName ? ` -- ${data.clinicName}` : ""}`,
      body: `${data.patientName ?? "A patient"} requested an appointment${data.dentistName ? ` with ${data.dentistName}` : ""}${
        date ? ` on ${date}` : ""
      }. Review it in the AI Inbox.`,
    }),
    fr: (data, date) => ({
      subject: `Nouvelle demande de rendez-vous${data.clinicName ? ` -- ${data.clinicName}` : ""}`,
      body: `${data.patientName ?? "Un patient"} a demande un rendez-vous${data.dentistName ? ` avec ${data.dentistName}` : ""}${
        date ? ` le ${date}` : ""
      }. Verifiez-le dans la boite de reception IA.`,
    }),
    ar: (data, date) => ({
      subject: `طلب موعد جديد${data.clinicName ? ` -- ${data.clinicName}` : ""}`,
      body: `طلب ${data.patientName ?? "مريض"} موعداً${data.dentistName ? ` مع ${data.dentistName}` : ""}${
        date ? ` في ${date}` : ""
      }. يرجى المراجعة في صندوق الذكاء الاصطناعي.`,
    }),
  },
  appointment_confirmed: {
    en: (data, date) => ({
      subject: "Your appointment is confirmed",
      body: `Hi ${data.patientName ?? "there"}, your appointment${data.serviceName ? ` for ${data.serviceName}` : ""}${
        data.dentistName ? ` with ${data.dentistName}` : ""
      } on ${date} is confirmed. -- ${data.clinicName}`,
    }),
    fr: (data, date) => ({
      subject: "Votre rendez-vous est confirme",
      body: `Bonjour ${data.patientName ?? ""}, votre rendez-vous${data.serviceName ? ` pour ${data.serviceName}` : ""}${
        data.dentistName ? ` avec ${data.dentistName}` : ""
      } le ${date} est confirme. -- ${data.clinicName}`,
    }),
    ar: (data, date) => ({
      subject: "تم تأكيد موعدك",
      body: `مرحباً ${data.patientName ?? ""}، تم تأكيد موعدك${data.serviceName ? ` لـ ${data.serviceName}` : ""}${
        data.dentistName ? ` مع ${data.dentistName}` : ""
      } في ${date}. -- ${data.clinicName}`,
    }),
  },
  appointment_cancelled: {
    en: (data, date) => ({
      subject: "Your appointment was cancelled",
      body: `Hi ${data.patientName ?? "there"}, your appointment${date ? ` on ${date}` : ""} has been cancelled.${
        data.reason ? ` Reason: ${data.reason}.` : ""
      } -- ${data.clinicName}`,
    }),
    fr: (data, date) => ({
      subject: "Votre rendez-vous a ete annule",
      body: `Bonjour ${data.patientName ?? ""}, votre rendez-vous${date ? ` du ${date}` : ""} a ete annule.${
        data.reason ? ` Raison : ${data.reason}.` : ""
      } -- ${data.clinicName}`,
    }),
    ar: (data, date) => ({
      subject: "تم إلغاء موعدك",
      body: `مرحباً ${data.patientName ?? ""}، تم إلغاء موعدك${date ? ` في ${date}` : ""}.${
        data.reason ? ` السبب: ${data.reason}.` : ""
      } -- ${data.clinicName}`,
    }),
  },
  appointment_rescheduled: {
    en: (data, date) => ({
      subject: "Your appointment was rescheduled",
      body: `Hi ${data.patientName ?? "there"}, your appointment has been moved to ${date}. -- ${data.clinicName}`,
    }),
    fr: (data, date) => ({
      subject: "Votre rendez-vous a ete reprogramme",
      body: `Bonjour ${data.patientName ?? ""}, votre rendez-vous a ete deplace au ${date}. -- ${data.clinicName}`,
    }),
    ar: (data, date) => ({
      subject: "تم تغيير موعدك",
      body: `مرحباً ${data.patientName ?? ""}، تم نقل موعدك إلى ${date}. -- ${data.clinicName}`,
    }),
  },
  appointment_reminder: {
    en: (data, date) => ({
      subject: "Appointment reminder",
      body: `Hi ${data.patientName ?? "there"}, this is a reminder of your appointment${
        data.dentistName ? ` with ${data.dentistName}` : ""
      } on ${date}. -- ${data.clinicName}`,
    }),
    fr: (data, date) => ({
      subject: "Rappel de rendez-vous",
      body: `Bonjour ${data.patientName ?? ""}, ceci est un rappel de votre rendez-vous${
        data.dentistName ? ` avec ${data.dentistName}` : ""
      } le ${date}. -- ${data.clinicName}`,
    }),
    ar: (data, date) => ({
      subject: "تذكير بالموعد",
      body: `مرحباً ${data.patientName ?? ""}، هذا تذكير بموعدك${data.dentistName ? ` مع ${data.dentistName}` : ""} في ${date}. -- ${
        data.clinicName
      }`,
    }),
  },
  conversation_escalated: {
    en: (data) => ({
      subject: `${data.clinicName}: AI assistant needs staff attention`,
      body: `The AI assistant escalated a conversation and needs staff review.\n\nReason: ${data.reason ?? "No reason given."}`,
    }),
    fr: (data) => ({
      subject: `${data.clinicName} : l'assistant IA a besoin d'une intervention`,
      body: `L'assistant IA a transfere une conversation et necessite une revue du personnel.\n\nRaison : ${
        data.reason ?? "Aucune raison donnee."
      }`,
    }),
    ar: (data) => ({
      subject: `${data.clinicName}: يحتاج المساعد الذكي إلى تدخل الموظفين`,
      body: `قام المساعد الذكي بتصعيد محادثة ويحتاج إلى مراجعة الموظفين.\n\nالسبب: ${data.reason ?? "لم يُذكر سبب."}`,
    }),
  },
};

/**
 * Renders the template for one (event type, channel, language) combo.
 * Channel only affects whether a subject is surfaced -- email is the
 * only channel with a distinct subject line; sms/whatsapp/in_app just
 * get the body (already fully self-describing on its own).
 */
export function renderNotificationTemplate(
  eventType: NotificationEventType,
  channel: NotificationDeliveryChannel,
  language: ResponseLanguage,
  data: TemplateData,
): RenderedTemplate {
  const formattedDate = formatAppointmentDateTime(data.startAt, data.timezone ?? "UTC", language);
  const { subject, body } = TEMPLATES[eventType][language](data, formattedDate);
  return { subject: channel === "email" ? subject : null, body };
}

/** A stable identifier for which template rendered a given delivery -- stored on notification_deliveries.template_key for auditing/debugging. */
export function templateKeyFor(eventType: NotificationEventType, channel: NotificationDeliveryChannel): string {
  return `${eventType}:${channel}`;
}
