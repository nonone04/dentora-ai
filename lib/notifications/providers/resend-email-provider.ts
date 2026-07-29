import type { NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";

/**
 * Real delivery via Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
 * Only selected by the provider factory when RESEND_API_KEY and
 * NOTIFICATIONS_FROM_EMAIL are both configured -- otherwise the factory
 * falls back to the logging provider, so nothing is ever sent for real
 * without explicit setup.
 */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = "email" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: message.to,
          subject: message.subject ?? "Appointment notification",
          text: message.body,
          ...(message.html ? { html: message.html } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `Resend API error (${response.status}): ${body}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}
