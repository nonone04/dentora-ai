import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

export type StaffInvitationProps = {
  inviterName: string;
  clinicName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
};

const COPY: Record<
  ResponseLanguage,
  { subject: (p: StaffInvitationProps) => string; preview: string; heading: string; body: (p: StaffInvitationProps) => string[]; cta: string }
> = {
  en: {
    subject: (p) => `${p.inviterName} invited you to join ${p.clinicName} on Dentora`,
    preview: "You've been invited to join a Dentora clinic team.",
    heading: "You've been invited",
    body: (p) => [
      `${p.inviterName} invited you to join ${p.clinicName} on Dentora as a ${p.role}.`,
      `This invitation expires in ${p.expiresInDays} days.`,
    ],
    cta: "Accept invitation",
  },
  fr: {
    subject: (p) => `${p.inviterName} vous invite à rejoindre ${p.clinicName} sur Dentora`,
    preview: "Vous avez été invité(e) à rejoindre une équipe Dentora.",
    heading: "Vous avez été invité(e)",
    body: (p) => [
      `${p.inviterName} vous a invité(e) à rejoindre ${p.clinicName} sur Dentora en tant que ${p.role}.`,
      `Cette invitation expire dans ${p.expiresInDays} jours.`,
    ],
    cta: "Accepter l'invitation",
  },
  ar: {
    subject: (p) => `دعاك ${p.inviterName} للانضمام إلى ${p.clinicName} على Dentora`,
    preview: "تمت دعوتك للانضمام إلى فريق عيادة على Dentora.",
    heading: "تمت دعوتك",
    body: (p) => [
      `دعاك ${p.inviterName} للانضمام إلى ${p.clinicName} على Dentora بصفة ${p.role}.`,
      `تنتهي صلاحية هذه الدعوة خلال ${p.expiresInDays} يوماً.`,
    ],
    cta: "قبول الدعوة",
  },
};

function render(props: StaffInvitationProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const subject = copy.subject(props);
  const paragraphs = copy.body(props);

  const bodyHtml = [renderWordmark(), renderHeading(copy.heading), ...paragraphs.map((p) => renderParagraph(p)), renderButton(copy.cta, props.acceptUrl)].join(
    "\n",
  );

  const html = renderEmailShell({
    subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.acceptUrl}`].join("\n\n");

  return { subject, html, text };
}

export const sampleStaffInvitationProps: StaffInvitationProps = {
  inviterName: "Dr. Amina Bennis",
  clinicName: "Bright Smile Dental",
  role: "receptionist",
  acceptUrl: "https://app.dentora.ai/invite/accept?token=sample",
  expiresInDays: 7,
};

export const staffInvitationTemplate: EmailTemplateEntry<StaffInvitationProps> = {
  id: "staff_invitation",
  category: "team",
  status: "wired",
  sampleProps: sampleStaffInvitationProps,
  render,
};
