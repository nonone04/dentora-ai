import { NextResponse } from "next/server";
import { executeTool } from "@/lib/ai/tools";

export const dynamic = "force-dynamic";

/**
 * Internal test harness for calling one AI tool directly, bypassing
 * the LLM entirely -- useful for verifying tool logic (permission
 * gating, clinic scoping, validation) independent of whether a mock
 * or real model would have chosen to call it. Same secret-protection
 * and "not patient-facing" reasoning as debug-orchestrate.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.AI_DEBUG_SECRET || authHeader !== `Bearer ${process.env.AI_DEBUG_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clinicId = body?.clinicId;
  const name = body?.name;
  const args = body?.args ?? {};

  if (typeof clinicId !== "string" || !clinicId) {
    return NextResponse.json({ error: "clinicId is required." }, { status: 400 });
  }
  if (typeof name !== "string" || !name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const result = await executeTool(name, args, {
      clinicId,
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : undefined,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Tool call failed." }, { status: 400 });
  }
}
