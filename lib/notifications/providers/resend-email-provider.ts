import type { NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";
import { getResendClient, isValidEmailAddress } from "@/lib/email/resend";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

/** Resend error codes worth retrying immediately -- transient/server-side, not a problem with the request itself. */
const RETRYABLE_ERROR_CODES = new Set(["rate_limit_exceeded", "internal_server_error", "application_error"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Real delivery via the Resend SDK (https://resend.com/docs/api-reference/emails/send-email).
 * Only selected by the provider factory when RESEND_API_KEY and
 * EMAIL_FROM are both configured -- otherwise the factory falls back to
 * the logging provider, so nothing is ever sent for real without
 * explicit setup.
 *
 * Adds a short in-process retry (up to 3 attempts, exponential backoff)
 * on transient Resend errors (rate limits, 5xxs) on top of the
 * dispatch pipeline's own longer-horizon scheduled retry
 * (lib/notifications/retry.ts) -- this one covers immediate/one-off
 * sends (lib/email/send.ts) that never go through that pipeline at all.
 */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = "email" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    if (!isValidEmailAddress(message.to)) {
      const error = `Invalid recipient email address: "${message.to}"`;
      console.error(`[email:resend] ${error}`);
      return { success: false, error };
    }

    const client = getResendClient(this.apiKey);

    let lastError = "Unknown error";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { error } = await client.emails.send({
          from: this.fromAddress,
          to: message.to,
          subject: message.subject ?? "Notification from Dentora",
          text: message.body,
          ...(message.html ? { html: message.html } : {}),
        });

        if (!error) return { success: true };

        lastError = `Resend API error (${error.name}): ${error.message}`;
        if (!RETRYABLE_ERROR_CODES.has(error.name) || attempt === MAX_ATTEMPTS) {
          console.error(`[email:resend] send to ${message.to} failed: ${lastError}`);
          return { success: false, error: lastError };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        if (attempt === MAX_ATTEMPTS) {
          console.error(`[email:resend] send to ${message.to} failed after ${attempt} attempts: ${lastError}`);
          return { success: false, error: lastError };
        }
      }

      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }

    return { success: false, error: lastError };
  }
}
