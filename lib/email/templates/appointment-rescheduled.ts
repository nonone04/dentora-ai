import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * Real send path: lib/notifications/email-html.ts renders this for the
 * "appointment_rescheduled" event. Only the new time is available at
 * send time (the underlying appointment record already reflects the new
 * time by the time this fires) -- matching the existing plain-text
 * template in lib/notifications/templates.ts, which has the same
 * limitation.
 */
export type AppointmentRescheduledProps = {
  patientName: string;
  clinicName: string;
  clinicEmail?: string | null;
  dentistName?: string | null;
  serviceName?: string | null;
  newDateTimeFormatted: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; intro: (p: AppointmentRescheduledProps) => string; labels: { dentist: string; service: string; when: string } }
> = {
  en: {
    subject: "Your appointment was rescheduled",
    preview: "Your appointment has a new time.",
    heading: "Appointment rescheduled",
    intro: (p) => `Hi ${p.patientName}, your appointment with ${p.clinicName} has been moved to a new time.`,
    labels: { dentist: "Dentist", service: "Service", when: "New time" },
  },
  fr: {
    subject: "Votre rendez-vous a été reprogrammé",
    preview: "Votre rendez-vous a un nouvel horaire.",
    heading: "Rendez-vous reprogrammé",
    intro: (p) => `Bonjour ${p.patientName}, votre rendez-vous avec ${p.clinicName} a été déplacé à un nouvel horaire.`,
    labels: { dentist: "Dentiste", service: "Service", when: "Nouvel horaire" },
  },
  ar: {
    subject: "تم تغيير موعدك",
    preview: "لموعدك وقت جديد.",
    heading: "تم تغيير الموعد",
    intro: (p) => `مرحباً ${p.patientName}، تم نقل موعدك مع ${p.clinicName} إلى وقت جديد.`,
    labels: { dentist: "الطبيب", service: "الخدمة", when: "الوقت الجديد" },
  },
};

function render(props: AppointmentRescheduledProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const rows: string[] = [renderInfoRow(copy.labels.when, props.newDateTimeFormatted)];
  if (props.dentistName) rows.push(renderInfoRow(copy.labels.dentist, props.dentistName));
  if (props.serviceName) rows.push(renderInfoRow(copy.labels.service, props.serviceName));

  const bodyHtml = [
    renderWordmark(props.clinicName),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
  ].join("\n");

  const html = renderEmailShell({
    subject: copy.subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const textLines = [copy.heading, copy.intro(props), `${copy.labels.when}: ${props.newDateTimeFormatted}`];
  if (props.dentistName) textLines.push(`${copy.labels.dentist}: ${props.dentistName}`);
  if (props.serviceName) textLines.push(`${copy.labels.service}: ${props.serviceName}`);

  return { subject: copy.subject, html, text: textLines.join("\n\n") };
}

export const sampleAppointmentRescheduledProps: AppointmentRescheduledProps = {
  patientName: "Karim",
  clinicName: "Bright Smile Dental",
  clinicEmail: "hello@brightsmile.example",
  dentistName: "Dr. Amina Bennis",
  serviceName: "Routine cleaning",
  newDateTimeFormatted: "Aug 5, 2026, 2:00 PM",
};

export const appointmentRescheduledTemplate: EmailTemplateEntry<AppointmentRescheduledProps> = {
  id: "appointment_rescheduled",
  category: "appointments",
  status: "wired",
  sampleProps: sampleAppointmentRescheduledProps,
  render,
};
