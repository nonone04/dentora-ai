import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- no public contact form exists in the
 * product yet. Built and previewable so the catalog/brand system is
 * complete; sample data is illustrative. See docs/customer-communications.md.
 */
export type ContactAutoReplyProps = {
  recipientName: string;
  subjectLine: string;
  expectedResponseTime: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; body: (p: ContactAutoReplyProps) => string[] }
> = {
  en: {
    subject: "We've received your message",
    preview: "Thanks for reaching out to Dentora.",
    heading: "Thanks for reaching out",
    body: (p) => [
      `Hi ${p.recipientName}, thanks for contacting Dentora about "${p.subjectLine}". We've received your message and a member of our team will get back to you ${p.expectedResponseTime}.`,
      "In the meantime, feel free to reply to this email if you have anything to add.",
    ],
  },
  fr: {
    subject: "Nous avons bien reçu votre message",
    preview: "Merci d'avoir contacté Dentora.",
    heading: "Merci de nous avoir contactés",
    body: (p) => [
      `Bonjour ${p.recipientName}, merci d'avoir contacté Dentora au sujet de « ${p.subjectLine} ». Nous avons bien reçu votre message et un membre de notre équipe vous répondra ${p.expectedResponseTime}.`,
      "N'hésitez pas à répondre à cet e-mail si vous souhaitez ajouter des informations.",
    ],
  },
  ar: {
    subject: "لقد استلمنا رسالتك",
    preview: "شكراً لتواصلك مع Dentora.",
    heading: "شكراً لتواصلك معنا",
    body: (p) => [
      `مرحباً ${p.recipientName}، شكراً لتواصلك مع Dentora بخصوص "${p.subjectLine}". لقد استلمنا رسالتك وسيتواصل معك أحد أعضاء فريقنا ${p.expectedResponseTime}.`,
      "لا تتردد في الرد على هذه الرسالة إذا كان لديك أي إضافة.",
    ],
  },
};

function render(props: ContactAutoReplyProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p))].join("\n");

  const html = renderEmailShell({
    subject: copy.subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [copy.heading, ...paragraphs].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const sampleContactAutoReplyProps: ContactAutoReplyProps = {
  recipientName: "Sarah",
  subjectLine: "Question about pricing",
  expectedResponseTime: "within 1 business day",
};

export const contactAutoReplyTemplate: EmailTemplateEntry<ContactAutoReplyProps> = {
  id: "contact_auto_reply",
  category: "support",
  status: "ready",
  sampleProps: sampleContactAutoReplyProps,
  render,
};
