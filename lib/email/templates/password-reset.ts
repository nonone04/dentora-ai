import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

export type PasswordResetProps = {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
};

const COPY: Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: (p: PasswordResetProps) => string[]; cta: string }> = {
  en: {
    subject: "Reset your password",
    preview: "Use this link to reset your Dentora password.",
    heading: "Reset your password",
    body: (p) => [
      `Hi ${p.recipientName}, we received a request to reset your Dentora password.`,
      `This link expires in ${p.expiresInMinutes} minutes. If you didn't request a reset, you can safely ignore this email — your password won't change.`,
    ],
    cta: "Reset password",
  },
  fr: {
    subject: "Réinitialisez votre mot de passe",
    preview: "Utilisez ce lien pour réinitialiser votre mot de passe Dentora.",
    heading: "Réinitialisez votre mot de passe",
    body: (p) => [
      `Bonjour ${p.recipientName}, nous avons reçu une demande de réinitialisation de votre mot de passe Dentora.`,
      `Ce lien expire dans ${p.expiresInMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail — votre mot de passe ne changera pas.`,
    ],
    cta: "Réinitialiser le mot de passe",
  },
  ar: {
    subject: "إعادة تعيين كلمة المرور",
    preview: "استخدم هذا الرابط لإعادة تعيين كلمة مرور Dentora الخاصة بك.",
    heading: "إعادة تعيين كلمة المرور",
    body: (p) => [
      `مرحباً ${p.recipientName}، تلقينا طلباً لإعادة تعيين كلمة مرور حساب Dentora الخاص بك.`,
      `تنتهي صلاحية هذا الرابط خلال ${p.expiresInMinutes} دقيقة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان — لن تتغير كلمة مرورك.`,
    ],
    cta: "إعادة تعيين كلمة المرور",
  },
};

function render(props: PasswordResetProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(copy.cta, props.resetUrl)].join(
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

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.resetUrl}`].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const samplePasswordResetProps: PasswordResetProps = {
  recipientName: "Sarah",
  resetUrl: "https://app.dentora.ai/reset-password?token=sample",
  expiresInMinutes: 60,
};

export const passwordResetTemplate: EmailTemplateEntry<PasswordResetProps> = {
  id: "password_reset",
  category: "account",
  status: "ready",
  sampleProps: samplePasswordResetProps,
  render,
};
