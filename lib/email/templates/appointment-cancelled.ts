import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/** Real send path: lib/notifications/email-html.ts renders this for the "appointment_cancelled" event. */
export type AppointmentCancelledProps = {
  patientName: string;
  clinicName: string;
  clinicEmail?: string | null;
  dateTimeFormatted?: string | null;
  reason?: string | null;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; intro: (p: AppointmentCancelledProps) => string; labels: { when: string; reason: string } }
> = {
  en: {
    subject: "Your appointment was cancelled",
    preview: "Your appointment has been cancelled.",
    heading: "Appointment cancelled",
    intro: (p) => `Hi ${p.patientName}, your appointment with ${p.clinicName} has been cancelled.`,
    labels: { when: "Was scheduled for", reason: "Reason" },
  },
  fr: {
    subject: "Votre rendez-vous a été annulé",
    preview: "Votre rendez-vous a été annulé.",
    heading: "Rendez-vous annulé",
    intro: (p) => `Bonjour ${p.patientName}, votre rendez-vous avec ${p.clinicName} a été annulé.`,
    labels: { when: "Était prévu pour", reason: "Raison" },
  },
  ar: {
    subject: "تم إلغاء موعدك",
    preview: "تم إلغاء موعدك.",
    heading: "تم إلغاء الموعد",
    intro: (p) => `مرحباً ${p.patientName}، تم إلغاء موعدك مع ${p.clinicName}.`,
    labels: { when: "كان مقرراً في", reason: "السبب" },
  },
};

function render(props: AppointmentCancelledProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const rows: string[] = [];
  if (props.dateTimeFormatted) rows.push(renderInfoRow(copy.labels.when, props.dateTimeFormatted));
  if (props.reason) rows.push(renderInfoRow(copy.labels.reason, props.reason));

  const bodyHtml = [
    renderWordmark(props.clinicName),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    ...(rows.length ? [renderDivider(), renderInfoTable(rows)] : []),
  ].join("\n");

  const html = renderEmailShell({
    subject: copy.subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const textLines = [copy.heading, copy.intro(props)];
  if (props.dateTimeFormatted) textLines.push(`${copy.labels.when}: ${props.dateTimeFormatted}`);
  if (props.reason) textLines.push(`${copy.labels.reason}: ${props.reason}`);

  return { subject: copy.subject, html, text: textLines.join("\n\n") };
}

export const sampleAppointmentCancelledProps: AppointmentCancelledProps = {
  patientName: "Karim",
  clinicName: "Bright Smile Dental",
  clinicEmail: "hello@brightsmile.example",
  dateTimeFormatted: "Aug 3, 2026, 10:00 AM",
  reason: "Requested by patient",
};

export const appointmentCancelledTemplate: EmailTemplateEntry<AppointmentCancelledProps> = {
  id: "appointment_cancelled",
  category: "appointments",
  status: "wired",
  sampleProps: sampleAppointmentCancelledProps,
  render,
};
