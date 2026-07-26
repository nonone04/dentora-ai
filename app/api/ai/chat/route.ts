import { NextResponse } from "next/server";
import { runConversationTurn } from "@/lib/ai/orchestrator";
import { getPublicClinicForChat } from "@/lib/ai/public-clinic";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4000;
const IP_RATE_LIMIT = 20;
const IP_RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_MESSAGES_PER_CONVERSATION = 60;

const UNAVAILABLE_MESSAGE = "This chat isn't available right now.";

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Public, unauthenticated patient chat endpoint -- the real inbound
 * channel /api/ai/debug-orchestrate exists to test without. Never
 * accepts clinicId or patientId from the client: clinic is resolved
 * server-side from slug, and patient identity is resolved the same
 * way Phase 12B already does it (by phone, inside draft_appointment),
 * never trusted from the wire. Response is limited to
 * {conversationId, reply} -- no tool names, inputs, or results.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`ip:${getClientIp(request)}`, IP_RATE_LIMIT, IP_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many messages. Please slow down and try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  const slug = typeof body?.slug === "string" ? body.slug : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;

  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const clinic = await getPublicClinicForChat(slug);
  if (!clinic) {
    return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  if (conversationId) {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if ((count ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) {
      return NextResponse.json(
        { error: "This conversation has reached its limit. Please contact the clinic directly." },
        { status: 429 },
      );
    }
  }

  try {
    const result = await runConversationTurn({
      clinicId: clinic.id,
      conversationId,
      channel: "web_chat",
      userMessage: message,
    });
    return NextResponse.json({ conversationId: result.conversationId, reply: result.reply });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  }
}
