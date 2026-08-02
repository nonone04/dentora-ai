import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * Internal lead-notification email -- sent to the sales/support inbox
 * (never to the visitor; see contact-auto-reply.ts for their confirmation)
 * whenever the public Contact page's form is submitted. Always rendered in
 * "en" regardless of the visitor's own locale (see app/actions/contact.ts),
 * since this lands in an internal team inbox rather than a customer's.
 * Optional fields are only present for the Custom Plan / Enterprise
 * inquiry, which collects clinic-sizing details the lighter general/quote/
 * demo inquiries don't ask for -- render() omits any row whose value is
 * missing rather than showing an empty placeholder.
 */
export type ContactSalesNotificationProps = {
  inquiryLabel: string;
  contactName: string;
  email: string;
  clinicName?: string;
  phone?: string;
  country?: string;
  dentistCount?: string;
  clinicCount?: string;
  currentSoftware?: string;
  requestedFeatures?: string;
  message: string;
};

const COPY: Record<
  ResponseLanguage,
  {
    subject: (p: ContactSalesNotificationProps) => string;
    preview: string;
    heading: string;
    intro: (p: ContactSalesNotificationProps) => string;
    labels: Record<
      "inquiry" | "contactName" | "email" | "clinicName" | "phone" | "country" | "dentistCount" | "clinicCount" | "currentSoftware" | "requestedFeatures" | "message",
      string
    >;
  }
> = {
  en: {
    subject: (p) => `[Contact] ${p.inquiryLabel} -- ${p.contactName}`,
    preview: "A new inquiry came in through the Dentora contact form.",
    heading: "New contact form submission",
    intro: (p) => `${p.contactName} submitted the Dentora contact form (${p.inquiryLabel}).`,
    labels: {
      inquiry: "Inquiry type",
      contactName: "Contact name",
      email: "Email",
      clinicName: "Clinic name",
      phone: "Phone number",
      country: "Country",
      dentistCount: "Number of dentists",
      clinicCount: "Number of clinics",
      currentSoftware: "Current software",
      requestedFeatures: "Requested features",
      message: "Message",
    },
  },
  fr: {
    subject: (p) => `[Contact] ${p.inquiryLabel} -- ${p.contactName}`,
    preview: "Une nouvelle demande a été reçue via le formulaire de contact Dentora.",
    heading: "Nouvelle soumission du formulaire de contact",
    intro: (p) => `${p.contactName} a soumis le formulaire de contact Dentora (${p.inquiryLabel}).`,
    labels: {
      inquiry: "Type de demande",
      contactName: "Nom du contact",
      email: "E-mail",
      clinicName: "Nom de la clinique",
      phone: "Numéro de téléphone",
      country: "Pays",
      dentistCount: "Nombre de dentistes",
      clinicCount: "Nombre de cliniques",
      currentSoftware: "Logiciel actuel",
      requestedFeatures: "Fonctionnalités demandées",
      message: "Message",
    },
  },
  ar: {
    subject: (p) => `[تواصل] ${p.inquiryLabel} -- ${p.contactName}`,
    preview: "تم استلام طلب جديد عبر نموذج التواصل الخاص بـ Dentora.",
    heading: "طلب جديد عبر نموذج التواصل",
    intro: (p) => `أرسل ${p.contactName} نموذج التواصل الخاص بـ Dentora (${p.inquiryLabel}).`,
    labels: {
      inquiry: "نوع الطلب",
      contactName: "اسم المتواصل",
      email: "البريد الإلكتروني",
      clinicName: "اسم العيادة",
      phone: "رقم الهاتف",
      country: "الدولة",
      dentistCount: "عدد أطباء الأسنان",
      clinicCount: "عدد العيادات",
      currentSoftware: "البرنامج الحالي",
      requestedFeatures: "الميزات المطلوبة",
      message: "الرسالة",
    },
  },
};

function render(props: ContactSalesNotificationProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const subject = copy.subject(props);

  const allRows: [string, string | undefined][] = [
    [copy.labels.inquiry, props.inquiryLabel],
    [copy.labels.contactName, props.contactName],
    [copy.labels.email, props.email],
    [copy.labels.clinicName, props.clinicName],
    [copy.labels.phone, props.phone],
    [copy.labels.country, props.country],
    [copy.labels.dentistCount, props.dentistCount],
    [copy.labels.clinicCount, props.clinicCount],
    [copy.labels.currentSoftware, props.currentSoftware],
    [copy.labels.requestedFeatures, props.requestedFeatures],
  ];
  const fieldRows = allRows.filter((row): row is [string, string] => Boolean(row[1]));

  const rows = fieldRows.map(([label, value]) => renderInfoRow(label, value));

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
    renderDivider(),
    renderParagraph(`${copy.labels.message}: ${props.message}`),
  ].join("\n");

  const html = renderEmailShell({
    subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [
    copy.heading,
    copy.intro(props),
    ...fieldRows.map(([label, value]) => `${label}: ${value}`),
    `${copy.labels.message}: ${props.message}`,
  ].join("\n\n");

  return { subject, html, text };
}

export const sampleContactSalesNotificationProps: ContactSalesNotificationProps = {
  inquiryLabel: "Custom / Enterprise plan",
  contactName: "Sarah Bennis",
  email: "sarah@example-clinic.com",
  clinicName: "Example Dental Group",
  phone: "+212 6 00 11 22 33",
  country: "Morocco",
  dentistCount: "12",
  clinicCount: "4",
  currentSoftware: "Spreadsheets",
  requestedFeatures: "Multi-clinic reporting, WhatsApp reminders",
  message: "We're looking to consolidate scheduling across our 4 locations -- can we set up a call?",
};

export const contactSalesNotificationTemplate: EmailTemplateEntry<ContactSalesNotificationProps> = {
  id: "contact_sales_notification",
  category: "support",
  status: "ready",
  sampleProps: sampleContactSalesNotificationProps,
  render,
};
