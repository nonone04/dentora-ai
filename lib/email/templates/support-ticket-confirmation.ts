import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- no support-ticket system exists in
 * the product yet. Built and previewable so the catalog/brand system is
 * complete; sample data is illustrative. See docs/customer-communications.md.
 */
export type SupportTicketConfirmationProps = {
  recipientName: string;
  ticketId: string;
  ticketSubject: string;
  statusUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  {
    subject: (p: SupportTicketConfirmationProps) => string;
    preview: string;
    heading: string;
    intro: (p: SupportTicketConfirmationProps) => string;
    labels: { ticketId: string; subject: string };
    cta: string;
  }
> = {
  en: {
    subject: (p) => `Support ticket #${p.ticketId} received`,
    preview: "We've opened a support ticket for your request.",
    heading: "Support ticket received",
    intro: (p) => `Hi ${p.recipientName}, we've opened a support ticket for your request and our team is on it.`,
    labels: { ticketId: "Ticket ID", subject: "Subject" },
    cta: "View ticket status",
  },
  fr: {
    subject: (p) => `Ticket d'assistance #${p.ticketId} reçu`,
    preview: "Un ticket d'assistance a été ouvert pour votre demande.",
    heading: "Ticket d'assistance reçu",
    intro: (p) => `Bonjour ${p.recipientName}, nous avons ouvert un ticket d'assistance pour votre demande et notre équipe s'en occupe.`,
    labels: { ticketId: "Numéro de ticket", subject: "Sujet" },
    cta: "Voir le statut du ticket",
  },
  ar: {
    subject: (p) => `تم استلام تذكرة الدعم رقم ${p.ticketId}`,
    preview: "لقد فتحنا تذكرة دعم لطلبك.",
    heading: "تم استلام تذكرة الدعم",
    intro: (p) => `مرحباً ${p.recipientName}، لقد فتحنا تذكرة دعم لطلبك وفريقنا يعمل عليها.`,
    labels: { ticketId: "رقم التذكرة", subject: "الموضوع" },
    cta: "عرض حالة التذكرة",
  },
};

function render(props: SupportTicketConfirmationProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const subject = copy.subject(props);
  const rows = [renderInfoRow(copy.labels.ticketId, props.ticketId), renderInfoRow(copy.labels.subject, props.ticketSubject)];

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
    renderButton(copy.cta, props.statusUrl),
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
    `${copy.labels.ticketId}: ${props.ticketId}`,
    `${copy.labels.subject}: ${props.ticketSubject}`,
    `${copy.cta}: ${props.statusUrl}`,
  ].join("\n\n");

  return { subject, html, text };
}

export const sampleSupportTicketConfirmationProps: SupportTicketConfirmationProps = {
  recipientName: "Sarah",
  ticketId: "10482",
  ticketSubject: "Unable to reschedule an appointment",
  statusUrl: "https://app.dentora.ai/support/tickets/10482",
};

export const supportTicketConfirmationTemplate: EmailTemplateEntry<SupportTicketConfirmationProps> = {
  id: "support_ticket_confirmation",
  category: "support",
  status: "ready",
  sampleProps: sampleSupportTicketConfirmationProps,
  render,
};
