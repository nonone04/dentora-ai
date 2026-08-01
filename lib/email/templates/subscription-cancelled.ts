import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * NOT wired to a real send path -- lib/stripe/ processes subscriptions
 * but nothing today emits a "subscription cancelled" event/hook. Built
 * and previewable so the catalog/brand system is complete; sample data
 * is illustrative. See docs/customer-communications.md.
 */
export type SubscriptionCancelledProps = {
  recipientName: string;
  clinicName: string;
  planName: string;
  accessUntilDateFormatted: string;
  reactivateUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  {
    subject: string;
    preview: string;
    heading: string;
    intro: (p: SubscriptionCancelledProps) => string;
    labels: { plan: string; accessUntil: string };
    cta: string;
  }
> = {
  en: {
    subject: "Your Dentora subscription has been cancelled",
    preview: "Your subscription was cancelled.",
    heading: "Subscription cancelled",
    intro: (p) =>
      `Hi ${p.recipientName}, we're sorry to see you go. Your ${p.planName} plan for ${p.clinicName} has been cancelled and won't renew.`,
    labels: { plan: "Plan", accessUntil: "Access until" },
    cta: "Reactivate subscription",
  },
  fr: {
    subject: "Votre abonnement Dentora a été annulé",
    preview: "Votre abonnement a été annulé.",
    heading: "Abonnement annulé",
    intro: (p) =>
      `Bonjour ${p.recipientName}, nous sommes désolés de vous voir partir. Votre forfait ${p.planName} pour ${p.clinicName} a été annulé et ne sera pas renouvelé.`,
    labels: { plan: "Forfait", accessUntil: "Accès jusqu'au" },
    cta: "Réactiver l'abonnement",
  },
  ar: {
    subject: "تم إلغاء اشتراكك في Dentora",
    preview: "تم إلغاء اشتراكك.",
    heading: "تم إلغاء الاشتراك",
    intro: (p) =>
      `مرحباً ${p.recipientName}، يؤسفنا رحيلك. تم إلغاء خطة ${p.planName} الخاصة بـ ${p.clinicName} ولن يتم تجديدها.`,
    labels: { plan: "الخطة", accessUntil: "الوصول متاح حتى" },
    cta: "إعادة تفعيل الاشتراك",
  },
};

function render(props: SubscriptionCancelledProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const rows = [renderInfoRow(copy.labels.plan, props.planName), renderInfoRow(copy.labels.accessUntil, props.accessUntilDateFormatted)];

  const bodyHtml = [
    renderWordmark(props.clinicName),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
    renderButton(copy.cta, props.reactivateUrl),
  ].join("\n");

  const html = renderEmailShell({
    subject: copy.subject,
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
    `${copy.labels.accessUntil}: ${props.accessUntilDateFormatted}`,
    `${copy.cta}: ${props.reactivateUrl}`,
  ].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const sampleSubscriptionCancelledProps: SubscriptionCancelledProps = {
  recipientName: "Sarah",
  clinicName: "Bright Smile Dental",
  planName: "Professional",
  accessUntilDateFormatted: "Sep 1, 2026",
  reactivateUrl: "https://app.dentora.ai/clinic/demo/settings/billing",
};

export const subscriptionCancelledTemplate: EmailTemplateEntry<SubscriptionCancelledProps> = {
  id: "subscription_cancelled",
  category: "billing",
  status: "ready",
  sampleProps: sampleSubscriptionCancelledProps,
  render,
};
