import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import type { EmailColorScheme } from "@/lib/email/brand";

export const EMAIL_TEMPLATE_IDS = [
  "welcome",
  "verify_email",
  "password_reset",
  "password_changed",
  "magic_login",
  "staff_invitation",
  "invitation_accepted",
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
  "payment_receipt",
  "subscription_activated",
  "subscription_cancelled",
  "trial_started",
  "trial_ending_7d",
  "trial_ending_1d",
  "contact_auto_reply",
  "contact_sales_notification",
  "support_ticket_confirmation",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

/** Preview/catalog grouping only -- unrelated to the in-app notification categories in lib/notifications/categories.ts. */
export const EMAIL_CATEGORIES = ["account", "team", "appointments", "billing", "support"] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

/**
 * "wired" = actually sent by app code today: the 4 appointment lifecycle
 * templates (via lib/notifications/email-html.ts), plus Welcome, Verify
 * Email, Password Reset, Password Changed, Staff Invitation, and
 * Invitation Accepted (via app/api/auth/send-email-hook/route.ts -- the
 * Supabase Auth "Send Email" hook -- and direct sendTemplatedEmail calls
 * in app/actions/{auth,clinics,team}.ts). "ready" = built, branded,
 * tested, and previewable, but not called from any send path, because the
 * triggering feature doesn't exist yet (trial/billing/contact
 * form/support tickets/passwordless auth). See docs/customer-communications.md.
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
