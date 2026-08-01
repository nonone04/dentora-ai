import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { renderButton, renderFooter, renderHeading, renderParagraph } from "@/lib/email/components";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailRenderOptions, EmailRenderResult, EmailTemplateEntry } from "@/lib/email/types";
import { renderWordmark } from "@/lib/email/wordmark";

/** Sent to the inviting admin/owner once the invited teammate accepts -- the counterpart to staff-invitation.ts. */
export type InvitationAcceptedProps = {
  recipientName: string;
  newMemberName: string;
  clinicName: string;
  role: string;
  manageTeamUrl: string;
};

const COPY: Record<
  ResponseLanguage,
  { subject: (p: InvitationAcceptedProps) => string; preview: string; heading: string; body: (p: InvitationAcceptedProps) => string[]; cta: string }
> = {
  en: {
    subject: (p) => `${p.newMemberName} joined ${p.clinicName}`,
    preview: "Your teammate accepted their invitation.",
    heading: "Invitation accepted",
    body: (p) => [`Hi ${p.recipientName}, ${p.newMemberName} accepted your invitation and joined ${p.clinicName} as a ${p.role}.`],
    cta: "Manage your team",
  },
  fr: {
    subject: (p) => `${p.newMemberName} a rejoint ${p.clinicName}`,
    preview: "Votre collègue a accepté son invitation.",
    heading: "Invitation acceptée",
    body: (p) => [`Bonjour ${p.recipientName}, ${p.newMemberName} a accepté votre invitation et a rejoint ${p.clinicName} en tant que ${p.role}.`],
    cta: "Gérer votre équipe",
  },
  ar: {
    subject: (p) => `انضم ${p.newMemberName} إلى ${p.clinicName}`,
    preview: "قَبِل زميلك الدعوة.",
    heading: "تم قبول الدعوة",
    body: (p) => [`مرحباً ${p.recipientName}، قَبِل ${p.newMemberName} دعوتك وانضم إلى ${p.clinicName} بصفة ${p.role}.`],
    cta: "إدارة فريقك",
  },
};

function render(props: InvitationAcceptedProps, language: ResponseLanguage, options?: EmailRenderOptions): EmailRenderResult {
  const copy = COPY[language];
  const subject = copy.subject(props);
  const paragraphs = copy.body(props);

  const bodyHtml = [
    renderWordmark(),
    renderHeading(copy.heading),
    ...paragraphs.map((p) => renderParagraph(p)),
    renderButton(copy.cta, props.manageTeamUrl),
  ].join("\n");

  const html = renderEmailShell({
    subject,
    previewText: copy.preview,
    bodyHtml,
    footerHtml: renderFooter(language),
    language,
    colorScheme: options?.forceColorScheme,
  });

  const text = [copy.heading, ...paragraphs, `${copy.cta}: ${props.manageTeamUrl}`].join("\n\n");

  return { subject, html, text };
}

export const sampleInvitationAcceptedProps: InvitationAcceptedProps = {
  recipientName: "Dr. Amina Bennis",
  newMemberName: "Youssef El Amrani",
  clinicName: "Bright Smile Dental",
  role: "receptionist",
  manageTeamUrl: "https://app.dentora.ai/clinic/demo/settings",
};

export const invitationAcceptedTemplate: EmailTemplateEntry<InvitationAcceptedProps> = {
  id: "invitation_accepted",
  category: "team",
  status: "wired",
  sampleProps: sampleInvitationAcceptedProps,
  render,
};
