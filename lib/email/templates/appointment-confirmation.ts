import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/** Real send path: lib/notifications/email-html.ts renders this for the "appointment_confirmed" event. */
export type AppointmentConfirmationProps = {
  patientName: string;
  clinicName: string;
  clinicEmail?: string | null;
  dentistName?: string | null;
  serviceName?: string | null;
  dateTimeFormatted: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; intro: (p: AppointmentConfirmationProps) => string; labels: { dentist: string; service: string; when: string } }
> = {
  en: {
    subject: "Your appointment is confirmed",
    preview: "Your appointment has been confirmed.",
    heading: "Appointment confirmed",
    intro: (p) => `Hi ${p.patientName}, your appointment with ${p.clinicName} is confirmed.`,
    labels: { dentist: "Dentist", service: "Service", when: "When" },
  },
  fr: {
    subject: "Votre rendez-vous est confirmé",
    preview: "Votre rendez-vous a été confirmé.",
    heading: "Rendez-vous confirmé",
    intro: (p) => `Bonjour ${p.patientName}, votre rendez-vous avec ${p.clinicName} est confirmé.`,
    labels: { dentist: "Dentiste", service: "Service", when: "Date" },
  },
  ar: {
    subject: "تم تأكيد موعدك",
    preview: "تم تأكيد موعدك.",
    heading: "تم تأكيد الموعد",
    intro: (p) => `مرحباً ${p.patientName}، تم تأكيد موعدك مع ${p.clinicName}.`,
    labels: { dentist: "الطبيب", service: "الخدمة", when: "التاريخ" },
  },
};

function render(props: AppointmentConfirmationProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
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

export const sampleAppointmentConfirmationProps: AppointmentConfirmationProps = {
  patientName: "Karim",
  clinicName: "Bright Smile Dental",
  clinicEmail: "hello@brightsmile.example",
  dentistName: "Dr. Amina Bennis",
  serviceName: "Routine cleaning",
  dateTimeFormatted: "Aug 3, 2026, 10:00 AM",
};

export const appointmentConfirmationTemplate: EmailTemplateEntry<AppointmentConfirmationProps> = {
  id: "appointment_confirmation",
  category: "appointments",
  status: "wired",
  sampleProps: sampleAppointmentConfirmationProps,
  render,
};
