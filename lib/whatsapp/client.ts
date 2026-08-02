import type { WhatsAppApiConfig, WhatsAppProfileResult, WhatsAppSendResult } from "@/lib/whatsapp/types";

const GRAPH_API_VERSION = "v21.0";
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

/** HTTP statuses worth retrying immediately -- rate limits and transient server errors, not a problem with the request itself. Same posture as lib/notifications/providers/resend-email-provider.ts. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GraphApiSendResponse = { messages?: { id: string }[] };
type GraphApiPhoneResponse = { verified_name?: string; display_phone_number?: string; quality_rating?: string };

/**
 * The one place in the app that calls Meta's WhatsApp Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages).
 * lib/notifications/providers/whatsapp-cloud-provider.ts (the scheduled/
 * automated send path) and lib/whatsapp/send.ts (the ad-hoc dashboard
 * send path) both delegate here instead of each doing their own fetch,
 * so there's exactly one Graph API integration to maintain.
 */
export async function sendTextMessage(config: WhatsAppApiConfig, to: string, body: string): Promise<WhatsAppSendResult> {
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as GraphApiSendResponse;
        const providerMessageId = data.messages?.[0]?.id;
        if (!providerMessageId) return { success: false, error: "WhatsApp Cloud API response carried no message id." };
        return { success: true, providerMessageId };
      }

      const responseBody = await response.text();
      lastError = `WhatsApp Cloud API error (${response.status}): ${responseBody}`;
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        return { success: false, error: lastError };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (attempt === MAX_ATTEMPTS) return { success: false, error: lastError };
    }

    await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
  }

  return { success: false, error: lastError };
}

/**
 * Sends a pre-approved Meta message template (the only way to reach a
 * patient outside the 24-hour customer-service window -- see
 * docs/customer-communications.md). Implemented and ready, but not
 * called anywhere by default: creating/approving templates in Meta
 * Business Manager is a manual step outside this repo, same category as
 * the Supabase Auth Hook setup. `components` follows the Cloud API's
 * own template-component shape (header/body/button parameters).
 */
export async function sendTemplateMessage(
  config: WhatsAppApiConfig,
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[],
): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `WhatsApp Cloud API error (${response.status}): ${body}` };
    }

    const data = (await response.json()) as GraphApiSendResponse;
    const providerMessageId = data.messages?.[0]?.id;
    if (!providerMessageId) return { success: false, error: "WhatsApp Cloud API response carried no message id." };
    return { success: true, providerMessageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Health-check / display data for the WhatsApp Settings page (Test
 * Connection button, connected business name). A successful response
 * confirms the access token + phone_number_id are both valid right now
 * -- the cheapest real signal the Graph API offers for "is this still
 * working."
 */
export async function getPhoneNumberProfile(config: WhatsAppApiConfig): Promise<WhatsAppProfileResult> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: { Authorization: `Bearer ${config.accessToken}` } },
    );

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `WhatsApp Cloud API error (${response.status}): ${body}` };
    }

    const data = (await response.json()) as GraphApiPhoneResponse;
    return {
      success: true,
      profile: {
        verifiedName: data.verified_name ?? null,
        displayPhoneNumber: data.display_phone_number ?? null,
        qualityRating: data.quality_rating ?? null,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
