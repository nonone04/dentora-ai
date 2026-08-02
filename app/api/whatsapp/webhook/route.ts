import { NextResponse } from "next/server";
import { runConversationTurn } from "@/lib/ai/orchestrator";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getNotificationProvider } from "@/lib/notifications/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClinicForPhoneNumberId } from "@/lib/whatsapp/clinic";
import { findPatientIdByPhone } from "@/lib/whatsapp/patient-match";
import type { CloudApiPayload } from "@/lib/whatsapp/types";
import { applyWhatsAppStatusUpdate, isValidSignature } from "@/lib/whatsapp/webhook";

export const dynamic = "force-dynamic";

const SENDER_RATE_LIMIT = 20;
const SENDER_RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 4000;
const REUSABLE_STATUSES = new Set(["active", "escalated"]);

/**
 * Meta's webhook subscription handshake -- called once when the webhook
 * URL is configured in the App dashboard, and any time the subscription
 * is re-verified.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * Inbound WhatsApp webhook deliveries (Phase 15, extended for delivery
 * status receipts). This route only does channel-specific plumbing --
 * signature verification, clinic/conversation/patient resolution,
 * sending the reply back out, applying status updates -- all the actual
 * logic lives in lib/whatsapp/webhook.ts and lib/ai/orchestrator's
 * runConversationTurn, the same function every other channel already
 * uses unmodified.
 */
export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const rawBody = await request.text();

  if (!appSecret || !isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as CloudApiPayload;
  const supabase = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const phoneNumberId = change.value?.metadata?.phone_number_id ?? "";

      for (const message of change.value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body) continue;

        try {
          await handleInboundMessage(supabase, {
            phoneNumberId,
            from: message.from,
            text: message.text.body,
          });
        } catch (err) {
          console.error("[whatsapp] failed to process inbound message", err instanceof Error ? err.message : err);
        }
      }

      for (const status of change.value?.statuses ?? []) {
        try {
          await applyWhatsAppStatusUpdate(supabase, status);
        } catch (err) {
          console.error("[whatsapp] failed to process status update", err instanceof Error ? err.message : err);
        }
      }
    }
  }

  // Always ACK once the signature is valid, even if a message failed --
  // a non-200 makes Meta re-deliver the whole batch.
  return NextResponse.json({ received: true });
}

async function handleInboundMessage(
  supabase: ReturnType<typeof createAdminClient>,
  { phoneNumberId, from, text }: { phoneNumberId: string; from: string; text: string },
) {
  if (!checkRateLimit(`whatsapp:${from}`, SENDER_RATE_LIMIT, SENDER_RATE_WINDOW_MS)) {
    console.warn(`[whatsapp] rate limited sender=${from}`);
    return;
  }

  const message = text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : text;

  const clinic = await getClinicForPhoneNumberId(phoneNumberId);
  if (!clinic) {
    console.warn(`[whatsapp] no clinic mapped to phone_number_id=${phoneNumberId}`);
    return;
  }

  const { data: existingConversation } = await supabase
    .from("ai_conversations")
    .select("id, status")
    .eq("clinic_id", clinic.id)
    .eq("channel", "whatsapp")
    .eq("external_thread_id", from)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversationId =
    existingConversation && REUSABLE_STATUSES.has(existingConversation.status) ? existingConversation.id : undefined;

  const patientId = await findPatientIdByPhone(clinic.id, from);

  const result = await runConversationTurn({
    clinicId: clinic.id,
    conversationId,
    channel: "whatsapp",
    patientId,
    externalThreadId: from,
    userMessage: message,
  });

  const sendResult = await getNotificationProvider("whatsapp").send({ to: from, body: result.reply });
  if (!sendResult.success) {
    console.error(`[whatsapp] failed to send reply to ${from}: ${sendResult.error}`);
  }
}
