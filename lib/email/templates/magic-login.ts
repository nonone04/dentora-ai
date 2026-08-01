import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- no magic-link/passwordless sign-in
 * flow exists in the product yet (app/actions/auth.ts is password-based,
 * with Supabase Auth handling verify/reset). Built and previewable so
 * the catalog/brand system is complete; sample data is illustrative. See
 * docs/customer-communications.md.
 */
export type MagicLoginProps = {
  recipientName: string;
  loginUrl: string;
  expiresInMinutes: number;
};

const COPY: Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: (p: MagicLoginProps) => string[]; cta: string }> = {
  en: {
    subject: "Your Dentora sign-in link",
    preview: "Use this link to sign in to Dentora.",
    heading: "Sign in to Dentora",
    body: (p) => [
      `Hi ${p.recipientName}, click below to sign in — no password needed.`,
      `This link expires in ${p.expiresInMinutes} minutes and can only be used once. If you didn't request this, you can safely ignore this email.`,
    ],
    cta: "Sign in",
  },
  fr: {
    subject: "Votre lien de connexion Dentora",
    preview: "Utilisez ce lien pour vous connecter à Dentora.",
    heading: "Connexion à Dentora",
    body: (p) => [
      `Bonjour ${p.recipientName}, cliquez ci-dessous pour vous connecter — aucun mot de passe requis.`,
      `Ce lien expire dans ${p.expiresInMinutes} minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.`,
    ],
    cta: "Se connecter",
  },
  ar: {
    subject: "رابط تسجيل الدخول إلى Dentora",
    preview: "استخدم هذا الرابط لتسجيل الدخول إلى Dentora.",
    heading: "تسجيل الدخول إلى Dentora",
    body: (p) => [
      `مرحباً ${p.recipientName}، اضغط أدناه لتسجيل الدخول — دون الحاجة إلى كلمة مرور.`,
      `تنتهي صلاحية هذا الرابط خلال ${p.expiresInMinutes} دقيقة ويمكن استخدامه مرة واحدة فقط. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.`,
    ],
    cta: "تسجيل الدخول",
  },
};

function render(props: MagicLoginProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(copy.cta, props.loginUrl)].join(
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

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.loginUrl}`].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const sampleMagicLoginProps: MagicLoginProps = {
  recipientName: "Sarah",
  loginUrl: "https://app.dentora.ai/login/magic?token=sample",
  expiresInMinutes: 15,
};

export const magicLoginTemplate: EmailTemplateEntry<MagicLoginProps> = {
  id: "magic_login",
  category: "account",
  status: "ready",
  sampleProps: sampleMagicLoginProps,
  render,
};
