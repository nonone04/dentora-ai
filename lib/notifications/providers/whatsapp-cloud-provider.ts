import type { NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";
import { sendTextMessage } from "@/lib/whatsapp/client";

/**
 * Real delivery via Meta's WhatsApp Cloud API. Only selected by the
 * provider factory when WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID
 * are both configured -- otherwise the factory falls back to the
 * logging provider, so nothing is ever sent for real without explicit
 * setup. One phone_number_id is used as the sender for every clinic
 * (single-WABA setup) -- see lib/notifications/provider.ts.
 *
 * Delegates the actual Graph API call to lib/whatsapp/client.ts, the
 * one place in the app that talks to Meta -- this class is just the
 * NotificationProvider-shaped adapter around it, same role
 * lib/notifications/providers/resend-email-provider.ts plays for email.
 */
export class WhatsAppCloudProvider implements NotificationProvider {
  readonly channel = "whatsapp" as const;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const result = await sendTextMessage({ accessToken: this.accessToken, phoneNumberId: this.phoneNumberId }, message.to, message.body);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, providerMessageId: result.providerMessageId };
  }
}
