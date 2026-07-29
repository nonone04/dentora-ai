import type { AnyEmailTemplateEntry, EmailTemplateId } from "@/lib/email/types";
import { EMAIL_TEMPLATE_IDS } from "@/lib/email/types";
import { appointmentCancelledTemplate } from "@/lib/email/templates/appointment-cancelled";
import { appointmentConfirmationTemplate } from "@/lib/email/templates/appointment-confirmation";
import { appointmentReminderTemplate } from "@/lib/email/templates/appointment-reminder";
import { appointmentRescheduledTemplate } from "@/lib/email/templates/appointment-rescheduled";
import { invitationAcceptedTemplate } from "@/lib/email/templates/invitation-accepted";
import { passwordChangedTemplate } from "@/lib/email/templates/password-changed";
import { passwordResetTemplate } from "@/lib/email/templates/password-reset";
import { staffInvitationTemplate } from "@/lib/email/templates/staff-invitation";
import { trialEnding1dTemplate } from "@/lib/email/templates/trial-ending-1d";
import { trialEnding7dTemplate } from "@/lib/email/templates/trial-ending-7d";
import { trialStartedTemplate } from "@/lib/email/templates/trial-started";
import { verifyEmailTemplate } from "@/lib/email/templates/verify-email";
import { welcomeTemplate } from "@/lib/email/templates/welcome";

/**
 * Single source of truth for every email template: the internal preview
 * page (app/admin/email-preview) and the template test suite both
 * iterate this map generically instead of hardcoding the 13 ids anywhere
 * else. Cast through `unknown` per entry since each template's Props
 * type is distinct -- callers that need a concrete Props type should
 * import that template's module directly (e.g. lib/notifications/email-html.ts).
 */
export const EMAIL_TEMPLATES: Record<EmailTemplateId, AnyEmailTemplateEntry> = {
  welcome: welcomeTemplate as AnyEmailTemplateEntry,
  verify_email: verifyEmailTemplate as AnyEmailTemplateEntry,
  password_reset: passwordResetTemplate as AnyEmailTemplateEntry,
  password_changed: passwordChangedTemplate as AnyEmailTemplateEntry,
  staff_invitation: staffInvitationTemplate as AnyEmailTemplateEntry,
  invitation_accepted: invitationAcceptedTemplate as AnyEmailTemplateEntry,
  appointment_confirmation: appointmentConfirmationTemplate as AnyEmailTemplateEntry,
  appointment_reminder: appointmentReminderTemplate as AnyEmailTemplateEntry,
  appointment_cancelled: appointmentCancelledTemplate as AnyEmailTemplateEntry,
  appointment_rescheduled: appointmentRescheduledTemplate as AnyEmailTemplateEntry,
  trial_started: trialStartedTemplate as AnyEmailTemplateEntry,
  trial_ending_7d: trialEnding7dTemplate as AnyEmailTemplateEntry,
  trial_ending_1d: trialEnding1dTemplate as AnyEmailTemplateEntry,
};

export function listEmailTemplates(): AnyEmailTemplateEntry[] {
  return EMAIL_TEMPLATE_IDS.map((id) => EMAIL_TEMPLATES[id]);
}
