import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import type { EmailColorScheme } from "@/lib/email/brand";

export const EMAIL_TEMPLATE_IDS = [
  "welcome",
  "verify_email",
  "password_reset",
  "password_changed",
  "staff_invitation",
  "invitation_accepted",
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
  "trial_started",
  "trial_ending_7d",
  "trial_ending_1d",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

/** Preview/catalog grouping only -- unrelated to the in-app notification categories in lib/notifications/categories.ts. */
export const EMAIL_CATEGORIES = ["account", "team", "appointments", "billing"] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

/**
 * "wired" = actually sent by app code today (the 4 appointment lifecycle
 * templates, via lib/notifications/email-html.ts). "ready" = built,
 * branded, tested, and previewable, but not called from any send path --
 * either because the triggering feature doesn't exist yet (trial/billing)
 * or because that email is currently owned by Supabase Auth's own
 * built-in system (welcome/verify/reset/invite). See
 * docs/customer-communications.md.
 */
export type EmailTemplateStatus = "wired" | "ready";

export type EmailRenderResult = { subject: string; html: string; text: string };

export type EmailRenderOptions = {
  /** Preview-only: forces a color scheme regardless of the recipient's real client/OS setting. Never set by real sends. */
  forceColorScheme?: EmailColorScheme;
};

export type EmailTemplateEntry<TProps> = {
  id: EmailTemplateId;
  category: EmailCategory;
  status: EmailTemplateStatus;
  sampleProps: TProps;
  render: (props: TProps, language: ResponseLanguage, options?: EmailRenderOptions) => EmailRenderResult;
};

/** Type-erased view used by the registry/preview page, which don't know each template's concrete Props type. */
export type AnyEmailTemplateEntry = EmailTemplateEntry<unknown>;
