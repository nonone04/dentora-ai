import { getLLMClient } from "@/lib/ai/llm";
import type { LLMMessage, LLMResponse, LLMUsage } from "@/lib/ai/llm/client";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { executeTool, getToolsForClinic } from "@/lib/ai/tools";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_TOOL_ITERATIONS = 4;
const FALLBACK_REPLY = "I'm having trouble completing that right now -- let me connect you with our staff.";

type TurnOutcome = "reply" | "tool_calls_exhausted" | "llm_error" | "escalated";

/**
 * Records one row per orchestrator turn for observability, plus a
 * grep-able structured log line -- mirrors the [notifications:channel]
 * convention already used in lib/notifications/provider.ts. Best-effort:
 * a logging failure must never affect the patient-facing reply.
 */
async function recordTurnEvent(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clinicId: string;
    conversationId: string;
    outcome: TurnOutcome;
    iterationCount: number;
    toolCalls: { name: string; input: Record<string, unknown> }[];
    usage?: LLMUsage;
    latencyMs: number;
    model?: string;
  },
) {
  console.log(
    `[ai:turn] clinic=${params.clinicId} conv=${params.conversationId} latencyMs=${params.latencyMs} ` +
      `tokens=${params.usage?.inputTokens ?? "?"}/${params.usage?.outputTokens ?? "?"} ` +
      `tools=${params.toolCalls.length} outcome=${params.outcome}`,
  );

  await supabase
    .from("ai_turn_events")
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      outcome: params.outcome,
      iteration_count: params.iterationCount,
      tool_calls: params.toolCalls,
      input_tokens: params.usage?.inputTokens ?? null,
      output_tokens: params.usage?.outputTokens ?? null,
      latency_ms: params.latencyMs,
      model: params.model ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[ai:turn] failed to record turn event", error.message);
    });
}

async function markEscalated(supabase: ReturnType<typeof createAdminClient>, conversationId: string) {
  await supabase.from("ai_conversations").update({ status: "escalated" }).eq("id", conversationId);
}

export type OrchestrateResult = {
  conversationId: string;
  reply: string;
  toolCalls: { name: string; input: Record<string, unknown> }[];
};

/**
 * Ties the LLM client + tool registry + conversation logging together
 * for one inbound message. Not wired to any real message channel --
 * see app/api/ai/debug-orchestrate for the (internal, secret-protected)
 * way to exercise this without WhatsApp.
 */
export async function runConversationTurn({
  clinicId,
  conversationId,
  channel,
  patientId,
  externalThreadId,
  userMessage,
}: {
  clinicId: string;
  conversationId?: string;
  channel: "whatsapp" | "web_chat" | "sms";
  patientId?: string;
  externalThreadId?: string;
  userMessage: string;
}): Promise<OrchestrateResult> {
  const supabase = createAdminClient();

  let activeConversationId = conversationId ?? null;

  if (activeConversationId) {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id, clinic_id")
      .eq("id", activeConversationId)
      .maybeSingle();
    if (!conversation || conversation.clinic_id !== clinicId) {
      throw new Error("Conversation not found for this clinic.");
    }
  } else {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId ?? null,
        channel,
        external_thread_id: externalThreadId ?? null,
      })
      .select("id")
      .single();
    if (error || !conversation) {
      throw new Error(error?.message ?? "Could not start a conversation.");
    }
    activeConversationId = conversation.id;
  }

  if (!activeConversationId) {
    throw new Error("Could not resolve a conversation id.");
  }
  const conversationIdForTurn: string = activeConversationId;

  await supabase.from("ai_messages").insert({
    conversation_id: conversationIdForTurn,
    role: "user",
    content: userMessage,
  });

  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content, ai_action")
    .eq("conversation_id", conversationIdForTurn)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", clinicId).single();

  const tools = await getToolsForClinic(clinicId);
  const llmTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  const systemPrompt = buildSystemPrompt({ clinicName: clinic?.name ?? "a dental clinic" });
  const model = process.env.ANTHROPIC_API_KEY ? (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5") : "mock";
  const startedAt = Date.now();

  // Prior tool-call bookkeeping rows (ai_action set, empty content) are
  // logging artifacts, not something the model should see as plain
  // text -- only carry forward real user/assistant turns as context.
  const messages: LLMMessage[] = (history ?? [])
    .filter((row) => !(row.role === "assistant" && row.ai_action))
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));

  const llm = getLLMClient();
  const toolCallsLog: { name: string; input: Record<string, unknown> }[] = [];
  let lastUsage: LLMUsage | undefined;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    let response: LLMResponse;
    try {
      response = await llm.complete({ systemPrompt, messages, tools: llmTools });
    } catch (err) {
      // A failed LLM call (rate limited, Anthropic outage, our own
      // timeout, bad response shape) degrades the same way running out
      // of tool iterations already does -- log it, tell the patient
      // plainly, hand off to staff. Never leaks the raw error upstream.
      console.error("[ai] LLM call failed", err instanceof Error ? err.message : err);
      await supabase.from("ai_messages").insert({
        conversation_id: conversationIdForTurn,
        role: "assistant",
        content: FALLBACK_REPLY,
      });
      await markEscalated(supabase, conversationIdForTurn);
      await recordTurnEvent(supabase, {
        clinicId,
        conversationId: conversationIdForTurn,
        outcome: "llm_error",
        iterationCount: iteration + 1,
        toolCalls: toolCallsLog,
        usage: lastUsage,
        latencyMs: Date.now() - startedAt,
        model,
      });
      return { conversationId: conversationIdForTurn, reply: FALLBACK_REPLY, toolCalls: toolCallsLog };
    }

    lastUsage = response.usage ?? lastUsage;

    if (response.type === "text") {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationIdForTurn,
        role: "assistant",
        content: response.text,
      });
      const escalatedThisTurn = toolCallsLog.some((call) => call.name === "escalate_to_staff");
      await recordTurnEvent(supabase, {
        clinicId,
        conversationId: conversationIdForTurn,
        outcome: escalatedThisTurn ? "escalated" : "reply",
        iterationCount: iteration + 1,
        toolCalls: toolCallsLog,
        usage: lastUsage,
        latencyMs: Date.now() - startedAt,
        model,
      });
      return { conversationId: conversationIdForTurn, reply: response.text, toolCalls: toolCallsLog };
    }

    messages.push({ role: "assistant", content: "", toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      toolCallsLog.push({ name: call.name, input: call.input });

      let resultContent: string;
      try {
        const result = await executeTool(call.name, call.input, {
          clinicId,
          conversationId: conversationIdForTurn,
        });
        resultContent = JSON.stringify(result);
      } catch (err) {
        resultContent = JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed." });
      }

      await supabase.from("ai_messages").insert({
        conversation_id: conversationIdForTurn,
        role: "assistant",
        content: "",
        ai_action: call.name,
        metadata: { toolCallId: call.id, input: call.input, result: resultContent },
      });

      messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: resultContent });
    }
  }

  await supabase.from("ai_messages").insert({
    conversation_id: conversationIdForTurn,
    role: "assistant",
    content: FALLBACK_REPLY,
  });
  await markEscalated(supabase, conversationIdForTurn);
  await recordTurnEvent(supabase, {
    clinicId,
    conversationId: conversationIdForTurn,
    outcome: "tool_calls_exhausted",
    iterationCount: MAX_TOOL_ITERATIONS,
    toolCalls: toolCallsLog,
    usage: lastUsage,
    latencyMs: Date.now() - startedAt,
    model,
  });

  return { conversationId: conversationIdForTurn, reply: FALLBACK_REPLY, toolCalls: toolCallsLog };
}
