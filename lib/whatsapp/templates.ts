import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import type { WhatsAppMessageType, WhatsAppTemplateData } from "@/lib/whatsapp/types";

const LOCALE_BY_LANGUAGE: Record<ResponseLanguage, string> = { en: "en-US", fr: "fr-FR", ar: "ar-MA" };

/** Date-only and time-only formatting, kept separate (unlike lib/notifications/templates.ts's combined formatAppointmentDateTime) since sendAppointmentReminder's public signature takes appointmentDate/appointmentTime as two distinct, already human-readable strings. */
export function formatAppointmentDate(iso: string, timezone: string, language: ResponseLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], { timeZone: timezone, dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatAppointmentTime(iso: string, timezone: string, language: ResponseLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], { timeZone: timezone, timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

type WhatsAppTemplateBuilder = (data: WhatsAppTemplateData) => string;

/**
 * Branded, conversational WhatsApp copy -- deliberately warmer than
 * lib/notifications/templates.ts's terse shared copy (which stays as-is
 * for email/sms/in_app). renderNotificationTemplate() defers to this
 * module specifically when the resolved channel is "whatsapp". No
 * accented characters, matching the existing fr/ar convention in
 * lib/notifications/templates.ts (reliable rendering across every
 * device WhatsApp runs on).
 */
const WHATSAPP_TEMPLATES: Record<WhatsAppMessageType, Record<ResponseLanguage, WhatsAppTemplateBuilder>> = {
  reminder: {
    en: (d) =>
      `Hello ${d.patientName ?? "there"} \u{1F44B}\n\nThis is a reminder from ${d.clinicName}.\n\nYour appointment${
        d.dentistName ? ` with ${d.dentistName}` : ""
      }${d.appointmentDate ? ` is on ${d.appointmentDate}` : ""}${d.appointmentTime ? ` at ${d.appointmentTime}` : ""}.\n\nPlease arrive 10 minutes early.\n\nReply YES to confirm or call us if you need to reschedule.\n\nThank you.`,
    fr: (d) =>
      `Bonjour ${d.patientName ?? ""} \u{1F44B}\n\nCeci est un rappel de ${d.clinicName}.\n\nVotre rendez-vous${
        d.dentistName ? ` avec ${d.dentistName}` : ""
      }${d.appointmentDate ? ` est prevu le ${d.appointmentDate}` : ""}${d.appointmentTime ? ` a ${d.appointmentTime}` : ""}.\n\nMerci d'arriver 10 minutes en avance.\n\nRepondez OUI pour confirmer ou appelez-nous pour reprogrammer.\n\nMerci.`,
    ar: (d) =>
      `مرحباً ${d.patientName ?? ""} \u{1F44B}\n\nهذا تذكير من ${d.clinicName}.\n\nموعدك${d.dentistName ? ` مع ${d.dentistName}` : ""}${
        d.appointmentDate ? ` يوم ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` الساعة ${d.appointmentTime}` : ""}.\n\nيرجى الحضور قبل 10 دقائق من الموعد.\n\nالرجاء الرد بـ YES للتأكيد أو الاتصال بنا لإعادة الجدولة.\n\nشكراً لكم.`,
  },
  confirmation: {
    en: (d) =>
      `Hello ${d.patientName ?? "there"} \u{1F44B}\n\nYour appointment${d.dentistName ? ` with ${d.dentistName}` : ""} at ${d.clinicName} is confirmed${
        d.appointmentDate ? ` for ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` at ${d.appointmentTime}` : ""}.\n\nWe look forward to seeing you. Reply if you have any questions.\n\nThank you.`,
    fr: (d) =>
      `Bonjour ${d.patientName ?? ""} \u{1F44B}\n\nVotre rendez-vous${d.dentistName ? ` avec ${d.dentistName}` : ""} a ${d.clinicName} est confirme${
        d.appointmentDate ? ` pour le ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` a ${d.appointmentTime}` : ""}.\n\nNous avons hate de vous accueillir. Repondez si vous avez des questions.\n\nMerci.`,
    ar: (d) =>
      `مرحباً ${d.patientName ?? ""} \u{1F44B}\n\nتم تأكيد موعدك${d.dentistName ? ` مع ${d.dentistName}` : ""} في ${d.clinicName}${
        d.appointmentDate ? ` يوم ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` الساعة ${d.appointmentTime}` : ""}.\n\nنتطلع لرؤيتك. راسلنا إذا كان لديك أي سؤال.\n\nشكراً لكم.`,
  },
  cancellation: {
    en: (d) =>
      `Hello ${d.patientName ?? "there"},\n\nYour appointment${d.appointmentDate ? ` on ${d.appointmentDate}` : ""} at ${
        d.clinicName
      } has been cancelled.${d.reason ? ` Reason: ${d.reason}.` : ""}\n\nPlease contact us if you'd like to reschedule.\n\nThank you.`,
    fr: (d) =>
      `Bonjour ${d.patientName ?? ""},\n\nVotre rendez-vous${d.appointmentDate ? ` du ${d.appointmentDate}` : ""} a ${
        d.clinicName
      } a ete annule.${d.reason ? ` Raison : ${d.reason}.` : ""}\n\nContactez-nous si vous souhaitez reprogrammer.\n\nMerci.`,
    ar: (d) =>
      `مرحباً ${d.patientName ?? ""}،\n\nتم إلغاء موعدك${d.appointmentDate ? ` في ${d.appointmentDate}` : ""} في ${d.clinicName}.${
        d.reason ? ` السبب: ${d.reason}.` : ""
      }\n\nيرجى التواصل معنا إذا رغبت في إعادة الجدولة.\n\nشكراً لكم.`,
  },
  reschedule: {
    en: (d) =>
      `Hello ${d.patientName ?? "there"},\n\nYour appointment at ${d.clinicName} has been rescheduled${
        d.appointmentDate ? ` to ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` at ${d.appointmentTime}` : ""}.\n\nPlease reply YES to confirm this new time or call us if it doesn't work.\n\nThank you.`,
    fr: (d) =>
      `Bonjour ${d.patientName ?? ""},\n\nVotre rendez-vous a ${d.clinicName} a ete reprogramme${
        d.appointmentDate ? ` au ${d.appointmentDate}` : ""
      }${d.appointmentTime ? ` a ${d.appointmentTime}` : ""}.\n\nRepondez OUI pour confirmer ce nouveau creneau ou appelez-nous si besoin.\n\nMerci.`,
    ar: (d) =>
      `مرحباً ${d.patientName ?? ""}،\n\nتم تغيير موعدك في ${d.clinicName}${d.appointmentDate ? ` إلى ${d.appointmentDate}` : ""}${
        d.appointmentTime ? ` الساعة ${d.appointmentTime}` : ""
      }.\n\nيرجى الرد بـ YES لتأكيد هذا الموعد الجديد أو الاتصال بنا إذا لم يناسبك.\n\nشكراً لكم.`,
  },
  completed: {
    en: (d) =>
      `Hello ${d.patientName ?? "there"} \u{1F44B}\n\nThank you for visiting ${d.clinicName} today${
        d.dentistName ? `, and for trusting ${d.dentistName} with your care` : ""
      }.\n\nWe hope you had a great experience.${
        d.reviewUrl ? ` If you have a moment, we'd really appreciate a quick Google review: ${d.reviewUrl}` : ""
      }\n\nThank you!`,
    fr: (d) =>
      `Bonjour ${d.patientName ?? ""} \u{1F44B}\n\nMerci de votre visite chez ${d.clinicName} aujourd'hui${
        d.dentistName ? `, et de votre confiance envers ${d.dentistName}` : ""
      }.\n\nNous esperons que vous avez passe un bon moment.${
        d.reviewUrl ? ` Si vous avez un instant, un avis Google serait tres apprecie : ${d.reviewUrl}` : ""
      }\n\nMerci !`,
    ar: (d) =>
      `مرحباً ${d.patientName ?? ""} \u{1F44B}\n\nشكراً لزيارتك ${d.clinicName} اليوم${
        d.dentistName ? `، ولثقتك بـ ${d.dentistName}` : ""
      }.\n\nنأمل أن تكون تجربتك جيدة.${
        d.reviewUrl ? ` إذا سمح وقتك، سنكون ممتنين لتقييمك لنا على Google: ${d.reviewUrl}` : ""
      }\n\nشكراً لكم!`,
  },
};

export function renderWhatsAppMessage(type: WhatsAppMessageType, language: ResponseLanguage, data: WhatsAppTemplateData): string {
  return WHATSAPP_TEMPLATES[type][language](data);
}
