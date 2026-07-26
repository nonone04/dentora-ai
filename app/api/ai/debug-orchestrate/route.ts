import { NextResponse } from "next/server";
import { runConversationTurn } from "@/lib/ai/orchestrator";

export const dynamic = "force-dynamic";

/**
 * Internal test harness for the orchestration loop -- NOT a
 * patient-facing endpoint and not a WhatsApp webhook. There is no
 * user session for this (same reasoning as /api/notifications/process),
 * so it's protected by a shared secret instead of Supabase auth.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.AI_DEBUG_SECRET || authHeader !== `Bearer ${process.env.AI_DEBUG_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clinicId = body?.clinicId;
  const message = body?.message;

  if (typeof clinicId !== "string" || !clinicId) {
    return NextResponse.json({ error: "clinicId is required." }, { status: 400 });
  }
  if (typeof message !== "string" || !message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  try {
    const result = await runConversationTurn({
      clinicId,
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : undefined,
      channel: body?.channel === "whatsapp" || body?.channel === "sms" ? body.channel : "web_chat",
      patientId: typeof body?.patientId === "string" ? body.patientId : undefined,
      userMessage: message,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Orchestration failed." },
      { status: 400 },
    );
  }
}
