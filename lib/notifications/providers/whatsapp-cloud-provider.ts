import type { NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";

const GRAPH_API_VERSION = "v21.0";

/**
 * Real delivery via Meta's WhatsApp Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages).
 * Only selected by the provider factory when WHATSAPP_ACCESS_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID are both configured -- otherwise the factory
 * falls back to the logging provider, so nothing is ever sent for real
 * without explicit setup. One phone_number_id is used as the sender for
 * every clinic (single-WABA setup) -- see lib/notifications/provider.ts.
 */
export class WhatsAppCloudProvider implements NotificationProvider {
  readonly channel = "whatsapp" as const;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to,
            type: "text",
            text: { body: message.body },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `WhatsApp Cloud API error (${response.status}): ${body}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}
