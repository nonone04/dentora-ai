import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

export type WelcomeProps = {
  recipientName: string;
  clinicName: string;
  dashboardUrl: string;
};

const COPY: Record<ResponseLanguage, { subject: string; preview: string; heading: string; body: string[]; cta: string }> = {
  en: {
    subject: "Welcome to Dentora",
    preview: "Your Dentora workspace is ready.",
    heading: "Welcome to Dentora",
    body: [
      "Hi {recipientName}, your Dentora workspace for {clinicName} is ready to go.",
      "Dentora handles your front desk conversations, appointment scheduling, and patient communication — so your team can focus on care.",
    ],
    cta: "Go to your dashboard",
  },
  fr: {
    subject: "Bienvenue sur Dentora",
    preview: "Votre espace Dentora est prêt.",
    heading: "Bienvenue sur Dentora",
    body: [
      "Bonjour {recipientName}, votre espace Dentora pour {clinicName} est prêt.",
      "Dentora gère vos conversations d'accueil, la prise de rendez-vous et la communication avec les patients — votre équipe peut se concentrer sur les soins.",
    ],
    cta: "Accéder à votre tableau de bord",
  },
  ar: {
    subject: "مرحباً بك في Dentora",
    preview: "مساحة عمل Dentora الخاصة بك جاهزة.",
    heading: "مرحباً بك في Dentora",
    body: [
      "مرحباً {recipientName}، مساحة عمل Dentora الخاصة بـ {clinicName} جاهزة الآن.",
      "تتولى Dentora محادثات الاستقبال وجدولة المواعيد والتواصل مع المرضى — لتتمكن فرقتك من التركيز على الرعاية.",
    ],
    cta: "الانتقال إلى لوحة التحكم",
  },
};

function interpolate(text: string, props: WelcomeProps): string {
  return text.replace("{recipientName}", props.recipientName).replace("{clinicName}", props.clinicName);
}

function render(props: WelcomeProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const paragraphs = copy.body.map((line) => interpolate(line, props));

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    ...paragraphs.map((p) => renderParagraph(p)),
    renderButton(copy.cta, props.dashboardUrl),
  ].join("\n");

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

export const sampleWelcomeProps: WelcomeProps = {
  recipientName: "Sarah",
  clinicName: "Bright Smile Dental",
  dashboardUrl: "https://app.dentora.ai/clinic/demo/dashboard",
};

export const welcomeTemplate: EmailTemplateEntry<WelcomeProps> = {
  id: "welcome",
  category: "account",
  status: "ready",
  sampleProps: sampleWelcomeProps,
  render,
};
