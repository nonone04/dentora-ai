import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import type { NotificationDeliveryChannel, NotificationEventType } from "@/lib/notifications/types";
import { formatAppointmentDate, formatAppointmentTime, renderWhatsAppMessage } from "@/lib/whatsapp/templates";
import type { WhatsAppMessageType } from "@/lib/whatsapp/types";

export type TemplateData = {
  clinicName: string;
  clinicEmail?: string | null;
  patientName?: string | null;
  dentistName?: string | null;
  serviceName?: string | null;
  startAt?: string | null;
  timezone?: string;
  reason?: string | null;
  /** appointment_completed only -- omitted from the message entirely when unset (see lib/notifications/settings.ts's googleReviewUrl). */
  reviewUrl?: string | null;
  /** custom_message only -- the staff-composed free text, passed straight through instead of built from a template. */
  customBody?: string | null;
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
  appointment_completed: {
    en: (data) => ({
      subject: `Thank you for visiting ${data.clinicName}`,
      body: `Hi ${data.patientName ?? "there"}, thank you for visiting ${data.clinicName}${
        data.dentistName ? ` and seeing ${data.dentistName}` : ""
      }. We hope you had a great experience.${
        data.reviewUrl ? ` If you have a moment, we'd appreciate a quick review: ${data.reviewUrl}` : ""
      }`,
    }),
    fr: (data) => ({
      subject: `Merci de votre visite chez ${data.clinicName}`,
      body: `Bonjour ${data.patientName ?? ""}, merci de votre visite chez ${data.clinicName}${
        data.dentistName ? ` et d'avoir consulte ${data.dentistName}` : ""
      }. Nous esperons que vous avez passe un bon moment.${
        data.reviewUrl ? ` Si vous avez un instant, un avis serait tres apprecie : ${data.reviewUrl}` : ""
      }`,
    }),
    ar: (data) => ({
      subject: `شكراً لزيارتك ${data.clinicName}`,
      body: `مرحباً ${data.patientName ?? ""}، شكراً لزيارتك ${data.clinicName}${
        data.dentistName ? ` ومقابلة ${data.dentistName}` : ""
      }. نأمل أن تكون تجربتك جيدة.${data.reviewUrl ? ` إذا سمح وقتك، سنكون ممتنين لتقييمك: ${data.reviewUrl}` : ""}`,
    }),
  },
  custom_message: {
    // Never actually invoked via this table -- renderNotificationTemplate short-circuits custom_message
    // to data.customBody before reaching TEMPLATES. Present only to satisfy Record<NotificationEventType, ...>.
    en: (data) => ({ subject: "Message from your clinic", body: data.customBody ?? "" }),
    fr: (data) => ({ subject: "Message de votre clinique", body: data.customBody ?? "" }),
    ar: (data) => ({ subject: "رسالة من عيادتك", body: data.customBody ?? "" }),
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

/** Which of lib/whatsapp/templates.ts's branded builders a given event type maps to, when the resolved channel is whatsapp. Event types with no entry (appointment_booked, conversation_escalated -- both staff-only, never sent via whatsapp; custom_message -- handled separately below) fall through to the shared TEMPLATES table above. */
const WHATSAPP_TEMPLATE_TYPE_BY_EVENT: Partial<Record<NotificationEventType, WhatsAppMessageType>> = {
  appointment_confirmed: "confirmation",
  appointment_cancelled: "cancellation",
  appointment_rescheduled: "reschedule",
  appointment_reminder: "reminder",
  appointment_completed: "completed",
};

/**
 * Renders the template for one (event type, channel, language) combo.
 * For every channel but whatsapp, this is just the shared TEMPLATES
 * table above, with channel only affecting whether a subject is
 * surfaced (email is the only channel with a distinct subject line).
 * custom_message always short-circuits to the staff-composed
 * data.customBody, on every channel, since there's no fixed copy to
 * render. Otherwise, when the resolved channel is whatsapp, rendering
 * defers to lib/whatsapp/templates.ts's warmer, branded copy instead of
 * the shared table -- see docs/customer-communications.md.
 */
export function renderNotificationTemplate(
  eventType: NotificationEventType,
  channel: NotificationDeliveryChannel,
  language: ResponseLanguage,
  data: TemplateData,
): RenderedTemplate {
  if (eventType === "custom_message") {
    return { subject: null, body: data.customBody ?? "" };
  }

  const whatsappType = channel === "whatsapp" ? WHATSAPP_TEMPLATE_TYPE_BY_EVENT[eventType] : undefined;
  if (whatsappType) {
    const timezone = data.timezone ?? "UTC";
    const body = renderWhatsAppMessage(whatsappType, language, {
      patientName: data.patientName,
      clinicName: data.clinicName,
      dentistName: data.dentistName,
      serviceName: data.serviceName,
      appointmentDate: data.startAt ? formatAppointmentDate(data.startAt, timezone, language) : null,
      appointmentTime: data.startAt ? formatAppointmentTime(data.startAt, timezone, language) : null,
      reason: data.reason,
      reviewUrl: data.reviewUrl,
    });
    return { subject: null, body };
  }

  const formattedDate = formatAppointmentDateTime(data.startAt, data.timezone ?? "UTC", language);
  const { subject, body } = TEMPLATES[eventType][language](data, formattedDate);
  return { subject: channel === "email" ? subject : null, body };
}

/** A stable identifier for which template rendered a given delivery -- stored on notification_deliveries.template_key for auditing/debugging. */
export function templateKeyFor(eventType: NotificationEventType, channel: NotificationDeliveryChannel): string {
  return `${eventType}:${channel}`;
}
