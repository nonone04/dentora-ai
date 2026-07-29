import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- no trial/subscription system exists
 * in the product yet (see lib/telemetry/dashboard.ts). Built and
 * previewable so the catalog/brand system is complete; sample data is
 * illustrative. See docs/customer-communications.md.
 */
export type TrialStartedProps = {
  recipientName: string;
  clinicName: string;
  trialDays: number;
  trialEndsDateFormatted: string;
  dashboardUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: string; preview: string; heading: string; body: (p: TrialStartedProps) => string[]; cta: string }
> = {
  en: {
    subject: "Your Dentora trial has started",
    preview: "Your free trial is now active.",
    heading: "Your trial has started",
    body: (p) => [
      `Hi ${p.recipientName}, your ${p.trialDays}-day free trial for ${p.clinicName} is now active.`,
      `Your trial ends on ${p.trialEndsDateFormatted}. Explore Dentora's AI front desk, scheduling, and patient communication tools risk-free.`,
    ],
    cta: "Go to your dashboard",
  },
  fr: {
    subject: "Votre essai Dentora a commencé",
    preview: "Votre essai gratuit est maintenant actif.",
    heading: "Votre essai a commencé",
    body: (p) => [
      `Bonjour ${p.recipientName}, votre essai gratuit de ${p.trialDays} jours pour ${p.clinicName} est maintenant actif.`,
      `Votre essai se termine le ${p.trialEndsDateFormatted}. Découvrez l'accueil IA, la planification et les outils de communication de Dentora sans risque.`,
    ],
    cta: "Accéder à votre tableau de bord",
  },
  ar: {
    subject: "بدأت فترتك التجريبية في Dentora",
    preview: "فترتك التجريبية المجانية نشطة الآن.",
    heading: "بدأت فترتك التجريبية",
    body: (p) => [
      `مرحباً ${p.recipientName}، فترتك التجريبية المجانية لمدة ${p.trialDays} يوماً لـ ${p.clinicName} نشطة الآن.`,
      `تنتهي فترتك التجريبية في ${p.trialEndsDateFormatted}. جرّب أدوات الاستقبال بالذكاء الاصطناعي والجدولة والتواصل مع المرضى في Dentora دون أي مخاطرة.`,
    ],
    cta: "الانتقال إلى لوحة التحكم",
  },
};

function render(props: TrialStartedProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(copy.cta, props.dashboardUrl)].join(
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

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.dashboardUrl}`].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const sampleTrialStartedProps: TrialStartedProps = {
  recipientName: "Sarah",
  clinicName: "Bright Smile Dental",
  trialDays: 14,
  trialEndsDateFormatted: "Aug 12, 2026",
  dashboardUrl: "https://app.dentora.ai/clinic/demo/dashboard",
};

export const trialStartedTemplate: EmailTemplateEntry<TrialStartedProps> = {
  id: "trial_started",
  category: "billing",
  status: "ready",
  sampleProps: sampleTrialStartedProps,
  render,
};
