import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry, EmailTemplateId } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/**
 * Shared builder for the two "Trial Ending" templates (7 days / 1 day
 * out) -- NOT wired to a real send path, same caveat as trial-started.ts:
 * no trial/subscription system exists in the product yet. Factored into
 * one helper since the two templates differ only in urgency framing, not
 * structure.
 */
export type TrialEndingProps = {
  recipientName: string;
  clinicName: string;
  trialEndsDateFormatted: string;
  upgradeUrl: string;
};

const CTA_LABEL: Record<ResponseLanguage, string> = {
  en: "Upgrade now",
  fr: "Passer à un forfait payant",
  ar: "الترقية الآن",
};

function copyForDays(daysRemaining: number): Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: (p: TrialEndingProps) => string[] }> {
  if (daysRemaining <= 1) {
    return {
      en: {
        subject: "Your Dentora trial ends tomorrow",
        preview: "Your trial ends tomorrow — upgrade to keep access.",
        heading: "Your trial ends tomorrow",
        body: (p) => [
          `Hi ${p.recipientName}, your free trial for ${p.clinicName} ends tomorrow (${p.trialEndsDateFormatted}).`,
          "Upgrade now to keep your AI front desk, scheduling, and patient communication running without interruption.",
        ],
      },
      fr: {
        subject: "Votre essai Dentora se termine demain",
        preview: "Votre essai se termine demain — passez à un forfait payant pour garder l'accès.",
        heading: "Votre essai se termine demain",
        body: (p) => [
          `Bonjour ${p.recipientName}, votre essai gratuit pour ${p.clinicName} se termine demain (${p.trialEndsDateFormatted}).`,
          "Passez à un forfait payant dès maintenant pour continuer à utiliser l'accueil IA, la planification et la communication patient sans interruption.",
        ],
      },
      ar: {
        subject: "تنتهي فترتك التجريبية في Dentora غداً",
        preview: "تنتهي فترتك التجريبية غداً — قم بالترقية للحفاظ على الوصول.",
        heading: "تنتهي فترتك التجريبية غداً",
        body: (p) => [
          `مرحباً ${p.recipientName}، تنتهي فترتك التجريبية المجانية لـ ${p.clinicName} غداً (${p.trialEndsDateFormatted}).`,
          "قم بالترقية الآن للحفاظ على استمرار الاستقبال بالذكاء الاصطناعي والجدولة والتواصل مع المرضى دون انقطاع.",
        ],
      },
    };
  }

  return {
    en: {
      subject: "Your Dentora trial ends in 7 days",
      preview: "Your trial ends in a week — upgrade to keep access.",
      heading: "Your trial ends in 7 days",
      body: (p) => [
        `Hi ${p.recipientName}, your free trial for ${p.clinicName} ends on ${p.trialEndsDateFormatted}.`,
        "Upgrade anytime before then to keep your AI front desk, scheduling, and patient communication running without interruption.",
      ],
    },
    fr: {
      subject: "Votre essai Dentora se termine dans 7 jours",
      preview: "Votre essai se termine dans une semaine — passez à un forfait payant.",
      heading: "Votre essai se termine dans 7 jours",
      body: (p) => [
        `Bonjour ${p.recipientName}, votre essai gratuit pour ${p.clinicName} se termine le ${p.trialEndsDateFormatted}.`,
        "Passez à un forfait payant avant cette date pour continuer à utiliser l'accueil IA, la planification et la communication patient sans interruption.",
      ],
    },
    ar: {
      subject: "تنتهي فترتك التجريبية في Dentora خلال 7 أيام",
      preview: "تنتهي فترتك التجريبية خلال أسبوع — قم بالترقية للحفاظ على الوصول.",
      heading: "تنتهي فترتك التجريبية خلال 7 أيام",
      body: (p) => [
        `مرحباً ${p.recipientName}، تنتهي فترتك التجريبية المجانية لـ ${p.clinicName} في ${p.trialEndsDateFormatted}.`,
        "قم بالترقية في أي وقت قبل ذلك للحفاظ على استمرار الاستقبال بالذكاء الاصطناعي والجدولة والتواصل مع المرضى دون انقطاع.",
      ],
    },
  };
}

export function createTrialEndingTemplate(id: Extract<EmailTemplateId, "trial_ending_7d" | "trial_ending_1d">, daysRemaining: number): EmailTemplateEntry<TrialEndingProps> {
  const copyByLanguage = copyForDays(daysRemaining);

  function render(props: TrialEndingProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
    const copy = copyByLanguage[language];
    const paragraphs = copy.body(props);
    const cta = CTA_LABEL[language];

    const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(cta, props.upgradeUrl)].join(
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

    const text = [copy.heading, ...paragraphs, `${cta}: ${props.upgradeUrl}`].join("\n\n");

    return { subject: copy.subject, html, text };
  }

  const sampleProps: TrialEndingProps = {
    recipientName: "Sarah",
    clinicName: "Bright Smile Dental",
    trialEndsDateFormatted: daysRemaining <= 1 ? "Jul 30, 2026" : "Aug 5, 2026",
    upgradeUrl: "https://app.dentora.ai/clinic/demo/settings/billing",
  };

  return {
    id,
    category: "billing",
    status: "ready",
    sampleProps,
    render,
  };
}
