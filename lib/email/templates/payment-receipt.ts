import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderDivider, renderFooter, renderHeading, renderInfoRow, renderInfoTable, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";
import { formatCurrency } from "@/lib/currency";

/**
 * NOT wired to a real send path -- billing (lib/stripe/) charges a plan
 * but nothing today emits a receipt-sent event/hook. Built and
 * previewable so the catalog/brand system is complete; sample data is
 * illustrative. See docs/customer-communications.md.
 */
export type PaymentReceiptProps = {
  recipientName: string;
  clinicName: string;
  planName: string;
  amountFormatted: string;
  paymentDateFormatted: string;
  receiptUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  {
    subject: string;
    preview: string;
    heading: string;
    intro: (p: PaymentReceiptProps) => string;
    labels: { plan: string; amount: string; date: string };
    cta: string;
  }
> = {
  en: {
    subject: "Your Dentora payment receipt",
    preview: "Here's your receipt for a recent Dentora payment.",
    heading: "Payment received",
    intro: (p) => `Hi ${p.recipientName}, we've received your payment for ${p.clinicName}. Here's your receipt.`,
    labels: { plan: "Plan", amount: "Amount", date: "Date" },
    cta: "View receipt",
  },
  fr: {
    subject: "Votre reçu de paiement Dentora",
    preview: "Voici votre reçu pour un paiement Dentora récent.",
    heading: "Paiement reçu",
    intro: (p) => `Bonjour ${p.recipientName}, nous avons bien reçu votre paiement pour ${p.clinicName}. Voici votre reçu.`,
    labels: { plan: "Forfait", amount: "Montant", date: "Date" },
    cta: "Voir le reçu",
  },
  ar: {
    subject: "إيصال الدفع الخاص بك في Dentora",
    preview: "إليك إيصال دفعتك الأخيرة في Dentora.",
    heading: "تم استلام الدفع",
    intro: (p) => `مرحباً ${p.recipientName}، لقد استلمنا دفعتك الخاصة بـ ${p.clinicName}. إليك إيصالك.`,
    labels: { plan: "الخطة", amount: "المبلغ", date: "التاريخ" },
    cta: "عرض الإيصال",
  },
};

function render(props: PaymentReceiptProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const rows = [
    renderInfoRow(copy.labels.plan, props.planName),
    renderInfoRow(copy.labels.amount, props.amountFormatted),
    renderInfoRow(copy.labels.date, props.paymentDateFormatted),
  ];

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    renderParagraph(copy.intro(props)),
    renderDivider(),
    renderInfoTable(rows),
    renderButton(copy.cta, props.receiptUrl),
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
    `${copy.labels.amount}: ${props.amountFormatted}`,
    `${copy.labels.date}: ${props.paymentDateFormatted}`,
    `${copy.cta}: ${props.receiptUrl}`,
  ].join("\n\n");

  return { subject: copy.subject, html, text };
}

export const samplePaymentReceiptProps: PaymentReceiptProps = {
  recipientName: "Sarah",
  clinicName: "Bright Smile Dental",
  planName: "Professional",
  // amountFormatted is always pre-formatted by the caller via
  // lib/currency's formatCurrency() using the clinic's own currency --
  // this sample just demonstrates that instead of hardcoding a symbol.
  amountFormatted: formatCurrency(990, "MAD", "fr-FR"),
  paymentDateFormatted: "Aug 1, 2026",
  receiptUrl: "https://app.dentora.ai/clinic/demo/settings/billing/receipts/sample",
};

export const paymentReceiptTemplate: EmailTemplateEntry<PaymentReceiptProps> = {
  id: "payment_receipt",
  category: "billing",
  status: "ready",
  sampleProps: samplePaymentReceiptProps,
  render,
};
