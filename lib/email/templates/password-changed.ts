import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderFooter, renderHeading, renderLink, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

export type PasswordChangedProps = {
  recipientName: string;
  changedAtFormatted: string;
  supportUrl: string;
};

const COPY: Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: (p: PasswordChangedProps) => string[]; linkLabel: string }> = {
  en: {
    subject: "Your password was changed",
    preview: "Your Dentora password was just changed.",
    heading: "Your password was changed",
    body: (p) => [
      `Hi ${p.recipientName}, this confirms your Dentora password was changed on ${p.changedAtFormatted}.`,
      "If this was you, no further action is needed. If you don't recognize this change, contact support immediately to secure your account.",
    ],
    linkLabel: "Contact support",
  },
  fr: {
    subject: "Votre mot de passe a été modifié",
    preview: "Votre mot de passe Dentora vient d'être modifié.",
    heading: "Votre mot de passe a été modifié",
    body: (p) => [
      `Bonjour ${p.recipientName}, ceci confirme que votre mot de passe Dentora a été modifié le ${p.changedAtFormatted}.`,
      "Si c'est bien vous, aucune action n'est requise. Si vous ne reconnaissez pas cette modification, contactez le support immédiatement pour sécuriser votre compte.",
    ],
    linkLabel: "Contacter le support",
  },
  ar: {
    subject: "تم تغيير كلمة المرور الخاصة بك",
    preview: "تم للتو تغيير كلمة مرور حساب Dentora الخاص بك.",
    heading: "تم تغيير كلمة المرور الخاصة بك",
    body: (p) => [
      `مرحباً ${p.recipientName}، هذا تأكيد بأن كلمة مرور حساب Dentora الخاص بك قد تم تغييرها بتاريخ ${p.changedAtFormatted}.`,
      "إذا كنت أنت من قام بذلك، فلا حاجة لأي إجراء إضافي. إذا كنت لا تعرف سبب هذا التغيير، يرجى التواصل مع الدعم فوراً لتأمين حسابك.",
    ],
    linkLabel: "التواصل مع الدعم",
  },
};

function render(props: PasswordChangedProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    ...paragraphs.map((p) => renderParagraph(p)),
    `<p style="margin:8px 0 0;">${renderLink(copy.linkLabel, props.supportUrl)}</p>`,
  ].join("\n");

  const html = renderEmailShell({
    subject: copy.subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [copy.heading, ...paragraphs, `${copy.linkLabel}: ${props.supportUrl}`].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const samplePasswordChangedProps: PasswordChangedProps = {
  recipientName: "Sarah",
  changedAtFormatted: "July 29, 2026, 3:14 PM",
  supportUrl: "https://dentora.ai/support",
};

export const passwordChangedTemplate: EmailTemplateEntry<PasswordChangedProps> = {
  id: "password_changed",
  category: "account",
  status: "ready",
  sampleProps: samplePasswordChangedProps,
  render,
};
