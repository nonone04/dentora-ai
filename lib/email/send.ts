import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { getNotificationProvider } from "@/lib/notifications/provider";
import { EMAIL_TEMPLATES } from "@/lib/email/registry";
import type { EmailTemplateId } from "@/lib/email/types";

export type SendTemplatedEmailResult = { success: true } | { success: false; error: string };

/**
 * Generic bridge from the email template registry to the existing
 * provider abstraction -- renders the named template then sends it
 * through whatever email provider lib/notifications/provider.ts resolves
 * today (Resend if configured, otherwise the safe logging fallback).
 * Not on any automatic trigger path; intended for one-off/manual sends
 * (e.g. a future "send test email" action from the preview page).
 */
export async function sendTemplatedEmail(
  templateId: EmailTemplateId,
  to: string,
  props: unknown,
  language: ResponseLanguage,
): Promise<SendTemplatedEmailResult> {
  const template = EMAIL_TEMPLATES[templateId];
  const rendered = template.render(props, language);

  const result = await getNotificationProvider("email").send({
    to,
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
  });

  return result.success ? { success: true } : { success: false, error: result.error };
}
