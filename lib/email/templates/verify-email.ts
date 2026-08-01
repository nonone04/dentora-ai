import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

export type VerifyEmailProps = {
  recipientName: string;
  verifyUrl: string;
  expiresInHours: number;
};

const COPY: Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: (p: VerifyEmailProps) => string[]; cta: string }> = {
  en: {
    subject: "Verify your email address",
    preview: "Confirm your email to finish setting up Dentora.",
    heading: "Verify your email address",
    body: (p) => [
      `Hi ${p.recipientName}, please confirm this is your email address to finish setting up your Dentora account.`,
      `This link expires in ${p.expiresInHours} hours. If you didn't request this, you can safely ignore this email.`,
    ],
    cta: "Verify email",
  },
  fr: {
    subject: "Vérifiez votre adresse e-mail",
    preview: "Confirmez votre e-mail pour finaliser votre compte Dentora.",
    heading: "Vérifiez votre adresse e-mail",
    body: (p) => [
      `Bonjour ${p.recipientName}, veuillez confirmer que cette adresse e-mail vous appartient pour finaliser la création de votre compte Dentora.`,
      `Ce lien expire dans ${p.expiresInHours} heures. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.`,
    ],
    cta: "Vérifier l'e-mail",
  },
  ar: {
    subject: "تأكيد عنوان بريدك الإلكتروني",
    preview: "أكّد بريدك الإلكتروني لإتمام إعداد حساب Dentora.",
    heading: "تأكيد عنوان بريدك الإلكتروني",
    body: (p) => [
      `مرحباً ${p.recipientName}، يرجى تأكيد أن هذا بريدك الإلكتروني لإتمام إعداد حساب Dentora الخاص بك.`,
      `تنتهي صلاحية هذا الرابط خلال ${p.expiresInHours} ساعة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.`,
    ],
    cta: "تأكيد البريد الإلكتروني",
  },
};

function render(props: VerifyEmailProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(copy.cta, props.verifyUrl)].join(
    "\n",
  );

  const html = renderEmailShell({
    subject: copy.subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.verifyUrl}`].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const sampleVerifyEmailProps: VerifyEmailProps = {
  recipientName: "Sarah",
  verifyUrl: "https://app.dentora.ai/verify-email?token=sample",
  expiresInHours: 24,
};

export const verifyEmailTemplate: EmailTemplateEntry<VerifyEmailProps> = {
  id: "verify_email",
  category: "account",
  status: "wired",
  sampleProps: sampleVerifyEmailProps,
  render,
};
