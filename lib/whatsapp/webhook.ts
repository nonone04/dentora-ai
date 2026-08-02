import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryEvent } from "@/lib/notifications/machine";
import { applyDeliveryEvent } from "@/lib/notifications/store";
import type { CloudApiStatus } from "@/lib/whatsapp/types";

/** Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body, keyed by the App secret) -- moved here from app/api/whatsapp/webhook/route.ts so both the inbound-message and status-callback handling share one verification path. */
export function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expected = Buffer.from(crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex"), "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) return false;

  return crypto.timingSafeEqual(expected, provided);
}

const STATUS_TO_EVENT: Partial<Record<CloudApiStatus["status"], DeliveryEvent>> = {
  delivered: "mark_delivered",
  read: "mark_read",
  failed: "mark_failed",
};

/**
 * Applies one inbound status receipt (Meta's `statuses[]`, delivered
 * alongside/instead of `messages[]` on the same webhook payload) to the
 * notification_deliveries row that produced it, matched via
 * provider_message_id (see the migration adding that column). A no-op
 * for "sent" (already our resting state right after a successful send)
 * and for any status whose message id we don't recognize -- e.g. a
 * receipt for a message sent before this column existed, or for an
 * inbound-reply send from lib/ai/orchestrator that isn't tracked as a
 * notification_deliveries row at all. Cross-tenant by construction
 * (looked up by provider_message_id alone), so callers must pass an
 * admin client, same as the rest of this webhook route.
 */
export async function applyWhatsAppStatusUpdate(supabase: SupabaseClient, status: CloudApiStatus): Promise<void> {
  const event = STATUS_TO_EVENT[status.status];
  if (!event) return;

  const { data: delivery } = await supabase
    .from("notification_deliveries")
    .select("id, clinic_id")
    .eq("provider_message_id", status.id)
    .maybeSingle();
  if (!delivery) return;

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();
  if (status.status === "delivered") patch.delivered_at = now;
  if (status.status === "read") patch.read_at = now;
  if (status.status === "failed") patch.last_error = status.errors?.[0]?.title ?? "Meta reported a delivery failure.";

  const outcome = await applyDeliveryEvent(supabase, {
    clinicId: delivery.clinic_id as string,
    id: delivery.id as string,
    event,
    patch,
  });
  if (!outcome.ok) {
    // Most commonly "invalid_transition" -- e.g. a duplicate/out-of-order
    // webhook redelivery Meta already sent once. Never worth retrying or
    // failing the webhook's 200 ack over.
    console.warn(`[whatsapp] could not apply status "${status.status}" to delivery ${delivery.id}: ${outcome.reason}`);
  }
}
