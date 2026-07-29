import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/** Real send path: lib/notifications/email-html.ts renders this for the "appointment_reminder" event. */
export type AppointmentReminderProps = {
  patientName: string;
  clinicName: string;
  clinicEmail?: string | null;
  dentistName?: string | null;
  serviceName?: string | null;
  dateTimeFormatted: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; intro: (p: AppointmentReminderProps) => string; labels: { dentist: string; service: string; when: string } }
> = {
  en: {
    subject: "Appointment reminder",
    preview: "This is a reminder of your upcoming appointment.",
    heading: "Upcoming appointment",
    intro: (p) => `Hi ${p.patientName}, this is a reminder of your upcoming appointment with ${p.clinicName}.`,
    labels: { dentist: "Dentist", service: "Service", when: "When" },
  },
  fr: {
    subject: "Rappel de rendez-vous",
    preview: "Ceci est un rappel de votre prochain rendez-vous.",
    heading: "Rendez-vous à venir",
    intro: (p) => `Bonjour ${p.patientName}, ceci est un rappel de votre prochain rendez-vous avec ${p.clinicName}.`,
    labels: { dentist: "Dentiste", service: "Service", when: "Date" },
  },
  ar: {
    subject: "تذكير بالموعد",
    preview: "هذا تذكير بموعدك القادم.",
    heading: "موعد قادم",
    intro: (p) => `مرحباً ${p.patientName}، هذا تذكير بموعدك القادم مع ${p.clinicName}.`,
    labels: { dentist: "الطبيب", service: "الخدمة", when: "التاريخ" },
  },
};

function render(props: AppointmentReminderProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const rows: string[] = [renderInfoRow(copy.labels.when, props.dateTimeFormatted)];
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

  const textLines = [copy.heading, copy.intro(props), `${copy.labels.when}: ${props.dateTimeFormatted}`];
  if (props.dentistName) textLines.push(`${copy.labels.dentist}: ${props.dentistName}`);
  if (props.serviceName) textLines.push(`${copy.labels.service}: ${props.serviceName}`);

  return { subject: copy.subject, html, text: textLines.join("\n\n") };
}

export const sampleAppointmentReminderProps: AppointmentReminderProps = {
  patientName: "Karim",
  clinicName: "Bright Smile Dental",
  clinicEmail: "hello@brightsmile.example",
  dentistName: "Dr. Amina Bennis",
  serviceName: "Routine cleaning",
  dateTimeFormatted: "Aug 3, 2026, 10:00 AM",
};

export const appointmentReminderTemplate: EmailTemplateEntry<AppointmentReminderProps> = {
  id: "appointment_reminder",
  category: "appointments",
  status: "wired",
  sampleProps: sampleAppointmentReminderProps,
  render,
};
