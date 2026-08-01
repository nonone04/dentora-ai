import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- lib/stripe/ processes subscriptions
 * but nothing today emits a "subscription activated" event/hook. Built
 * and previewable so the catalog/brand system is complete; sample data
 * is illustrative. See docs/customer-communications.md.
 */
export type SubscriptionActivatedProps = {
  recipientName: string;
  clinicName: string;
  planName: string;
  amountFormatted: string;
  nextBillingDateFormatted: string;
  dashboardUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  {
    subject: (p: SubscriptionActivatedProps) => string;
    preview: string;
    heading: string;
    intro: (p: SubscriptionActivatedProps) => string;
    labels: { plan: string; amount: string; nextBilling: string };
    cta: string;
  }
> = {
  en: {
    subject: (p) => `Your ${p.planName} plan is active`,
    preview: "Your Dentora subscription is now active.",
    heading: "Subscription activated",
    intro: (p) => `Hi ${p.recipientName}, your ${p.planName} plan for ${p.clinicName} is now active. Thanks for subscribing!`,
    labels: { plan: "Plan", amount: "Amount", nextBilling: "Next billing date" },
    cta: "Go to your dashboard",
  },
  fr: {
    subject: (p) => `Votre forfait ${p.planName} est actif`,
    preview: "Votre abonnement Dentora est maintenant actif.",
    heading: "Abonnement activé",
    intro: (p) => `Bonjour ${p.recipientName}, votre forfait ${p.planName} pour ${p.clinicName} est maintenant actif. Merci pour votre confiance !`,
    labels: { plan: "Forfait", amount: "Montant", nextBilling: "Prochaine facturation" },
    cta: "Accéder à votre tableau de bord",
  },
  ar: {
    subject: (p) => `خطتك ${p.planName} نشطة الآن`,
    preview: "اشتراكك في Dentora نشط الآن.",
    heading: "تم تفعيل الاشتراك",
    intro: (p) => `مرحباً ${p.recipientName}، خطة ${p.planName} الخاصة بـ ${p.clinicName} نشطة الآن. شكراً لاشتراكك!`,
    labels: { plan: "الخطة", amount: "المبلغ", nextBilling: "تاريخ الفوترة القادم" },
    cta: "الانتقال إلى لوحة التحكم",
  },
};

function render(props: SubscriptionActivatedProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const subject = copy.subject(props);
  const rows = [
    renderInfoRow(copy.labels.plan, props.planName),
    renderInfoRow(copy.labels.amount, props.amountFormatted),
    renderInfoRow(copy.labels.nextBilling, props.nextBillingDateFormatted),
  ];

  const bodyHtml = [
    renderWordmark(props.clinicName),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
    renderButton(copy.cta, props.dashboardUrl),
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
    `${copy.labels.plan}: ${props.planName}`,
    `${copy.labels.amount}: ${props.amountFormatted}`,
    `${copy.labels.nextBilling}: ${props.nextBillingDateFormatted}`,
    `${copy.cta}: ${props.dashboardUrl}`,
  ].join("\n\n");

  return { subject, html, text };
}

export const sampleSubscriptionActivatedProps: SubscriptionActivatedProps = {
  recipientName: "Sarah",
  clinicName: "Bright Smile Dental",
  planName: "Professional",
  amountFormatted: "$99.00/mo",
  nextBillingDateFormatted: "Sep 1, 2026",
  dashboardUrl: "https://app.dentora.ai/clinic/demo/dashboard",
};

export const subscriptionActivatedTemplate: EmailTemplateEntry<SubscriptionActivatedProps> = {
  id: "subscription_activated",
  category: "billing",
  status: "ready",
  sampleProps: sampleSubscriptionActivatedProps,
  render,
};
