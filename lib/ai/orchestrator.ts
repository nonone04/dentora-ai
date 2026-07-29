import { getAvailabilityForState, recordAvailabilityQuery } from "@/lib/ai/availability";
import { decide, recordDecisionEvent } from "@/lib/ai/decision";
import { retrieveClinicKnowledge } from "@/lib/ai/knowledge";
import type { KnowledgeSearchResult } from "@/lib/ai/knowledge/types";
import { getLLMClient } from "@/lib/ai/llm";
import type { LLMMessage, LLMResponse, LLMUsage } from "@/lib/ai/llm/client";
import { extractNLU, parseNLUExtraction, recordNLUEvent } from "@/lib/ai/nlu";
import type { NLUExtraction } from "@/lib/ai/nlu/types";
import { loadPatientProfile, recordPatientActivity, refreshPatientProfile } from "@/lib/ai/patient";
import type { PatientProfile } from "@/lib/ai/patient/types";
import { AIPermissionError, assertActionAllowed } from "@/lib/ai/permissions";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { applyIncrementalUpdate } from "@/lib/ai/state";
import { performEscalation } from "@/lib/ai/tools/escalate-to-staff";
import { executeTool, getToolsForClinic } from "@/lib/ai/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import { track } from "@/lib/telemetry";

const MAX_TOOL_ITERATIONS = 4;
const FALLBACK_REPLY = "I'm having trouble completing that right now -- let me connect you with our staff.";

/** Intents worth spending a knowledge-base lookup on -- see lib/ai/nlu/types.ts's NLUIntent for the full set. */
const KNOWLEDGE_RELEVANT_INTENTS = new Set(["ask_faq", "get_clinic_info"]);

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

  // Fires once per turn, as a documented approximation of "conversation
  // completed" -- the orchestrator has no per-thread close event (see
  // docs/product-analytics.md).
  await track({
    name: "AI Conversation Completed",
    clinicId: params.clinicId,
    properties: { outcome: params.outcome },
  });
}

async function markEscalated(supabase: ReturnType<typeof createAdminClient>, conversationId: string) {
  await supabase.from("ai_conversations").update({ status: "escalated" }).eq("id", conversationId);
}

/**
 * Carries out the Decision Engine's escalate_to_staff/emergency_workflow
 * verdicts (lib/ai/decision) -- the router itself is a pure function
 * that doesn't know whether this clinic actually has escalate_to_staff
 * enabled, so this re-checks the permission gate fresh, same as every
 * AI tool does (lib/ai/permissions.ts: no caching, so a clinic that just
 * disabled the action takes effect immediately). Returns whether the
 * escalation actually happened.
 */
async function applyEscalationSideEffect(clinicId: string, conversationId: string, reason: string): Promise<boolean> {
  try {
    await assertActionAllowed(clinicId, "escalate_to_staff");
    await performEscalation({ clinicId, conversationId }, reason);
    return true;
  } catch (err) {
    if (!(err instanceof AIPermissionError)) {
      console.error("[ai:decision] escalation side effect failed", err instanceof Error ? err.message : err);
    }
    return false;
  }
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
  let isNewConversation = false;

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
    isNewConversation = true;
  }

  if (!activeConversationId) {
    throw new Error("Could not resolve a conversation id.");
  }
  const conversationIdForTurn: string = activeConversationId;

  if (isNewConversation) {
    await track({ name: "AI Conversation Started", clinicId });
  }

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

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, default_language")
    .eq("id", clinicId)
    .single();

  const startedAt = Date.now();
  const clinicName = clinic?.name ?? "a dental clinic";

  // Prior tool-call bookkeeping rows (ai_action set, empty content) are
  // logging artifacts, not something the model should see as plain
  // text -- only carry forward real user/assistant turns as context.
  const messages: LLMMessage[] = (history ?? [])
    .filter((row) => !(row.role === "assistant" && row.ai_action))
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));

  // Structured NLU extraction step, ahead of tool selection -- see
  // lib/ai/nlu. Never allowed to take the turn down: a failure here
  // degrades to a neutral, zero-confidence extraction so the turn falls
  // through to the normal tool-selection loop unaffected.
  const nluStartedAt = Date.now();
  let nlu: NLUExtraction;
  try {
    nlu = await extractNLU({ messages, clinicName });
  } catch (err) {
    console.error("[ai:nlu] extraction failed", err instanceof Error ? err.message : err);
    nlu = parseNLUExtraction({}, userMessage);
  }
  const nluModel = process.env.ANTHROPIC_API_KEY ? (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5") : "rule-based";
  await recordNLUEvent(supabase, {
    clinicId,
    conversationId: conversationIdForTurn,
    extraction: nlu,
    latencyMs: Date.now() - nluStartedAt,
    model: nluModel,
  });

  // Decision Engine: deterministic routing immediately after NLU, ahead
  // of tool selection -- see lib/ai/decision. decide() is a pure
  // function (emergency detection, explicit escalation, greetings,
  // missing-field follow-ups), so these business rules never depend on
  // the LLM being reachable at all. Only "execute_tool" (nothing
  // deterministic matched) falls through to the existing tool-selection
  // loop below.
  const decisionStartedAt = Date.now();
  const decision = decide(nlu, { patientKnown: Boolean(patientId), clinicDefaultLanguage: clinic?.default_language });
  await recordDecisionEvent(supabase, {
    clinicId,
    conversationId: conversationIdForTurn,
    decision,
    nlu,
    latencyMs: Date.now() - decisionStartedAt,
    model: nluModel,
  });

  // Conversation State Engine: fold this turn's NLUExtraction into the
  // conversation's accumulated state and persist it -- see lib/ai/state.
  // Runs unconditionally, ahead of every branch below, so state is never
  // skipped regardless of which path this turn takes -- and is exposed
  // to downstream tool execution via AIToolContext.conversationState.
  const conversationState = await applyIncrementalUpdate(supabase, {
    clinicId,
    conversationId: conversationIdForTurn,
    nlu,
    patientKnown: Boolean(patientId),
    decisionKind: decision.kind,
  });

  // Availability Engine: a proactive, ranked query against real dentist
  // schedules -- see lib/ai/availability. Integrated immediately after
  // the Conversation State layer so appointment-related turns are
  // grounded in actual bookable slots (via the system prompt below and
  // AIToolContext.availability) instead of an LLM guess. A no-op (null)
  // whenever this turn isn't appointment-related or there's no date yet
  // to search -- the Decision Engine's ask_follow_up collects one first.
  const availabilityStartedAt = Date.now();
  const availability = await getAvailabilityForState(supabase, conversationState);
  if (availability) {
    await recordAvailabilityQuery(supabase, {
      clinicId,
      conversationId: conversationIdForTurn,
      result: availability,
      latencyMs: Date.now() - availabilityStartedAt,
    });
  }

  // Clinic Knowledge Engine: deterministic, retrieval-first search
  // against structured clinic knowledge (services, pricing, hours,
  // insurance, payment methods, parking, cancellation policy, FAQs,
  // emergency guidance) -- see lib/ai/knowledge. Injects only the
  // handful of matching records into the system prompt (below) instead
  // of the clinic's whole profile, and is exposed to downstream tool
  // execution via AIToolContext.knowledge. A no-op (null) whenever this
  // turn's intent isn't knowledge-relevant; never throws on its own
  // (retrieveClinicKnowledge degrades to a clean miss internally).
  const knowledge: KnowledgeSearchResult | null = KNOWLEDGE_RELEVANT_INTENTS.has(conversationState.intent)
    ? await retrieveClinicKnowledge(supabase, {
        clinicId,
        query: conversationState.lastMessage,
        conversationId: conversationIdForTurn,
      })
    : null;

  // Patient Intelligence Engine: best-effort profile load/refresh for a
  // known patient -- see lib/ai/patient. Exposed to the system prompt
  // (below) and to downstream tool execution via
  // AIToolContext.patientProfile. The profile's own data is driven
  // primarily by appointment outcomes via the Appointment Lifecycle
  // Engine's hook (lib/ai/appointments/store.ts), so this orchestrator-
  // side touch stays light: log a "conversation_started" timeline entry
  // for a brand-new conversation, then load (or, for a first-ever
  // interaction, compute) the current profile.
  let patientProfile: PatientProfile | null = null;
  if (patientId) {
    try {
      if (isNewConversation) {
        await recordPatientActivity(supabase, {
          clinicId,
          patientId,
          type: "conversation_started",
          conversationId: conversationIdForTurn,
        });
      }
      patientProfile = await loadPatientProfile(supabase, { clinicId, patientId });
      if (!patientProfile) {
        patientProfile = await refreshPatientProfile(supabase, { clinicId, patientId });
      }
    } catch (err) {
      console.error("[ai:patient] failed to load/refresh patient profile", err instanceof Error ? err.message : err);
    }
  }

  if (decision.kind === "emergency_workflow") {
    await applyEscalationSideEffect(clinicId, conversationIdForTurn, decision.reason);
    // A possible emergency always gets this safety reply, whether or
    // not the escalation side effect above actually succeeded (e.g. the
    // clinic hasn't enabled escalate_to_staff) -- this is patient safety
    // guidance, not a claim about what the clinic's system did.
    await supabase.from("ai_messages").insert({
      conversation_id: conversationIdForTurn,
      role: "assistant",
      content: decision.reply,
    });
    await recordTurnEvent(supabase, {
      clinicId,
      conversationId: conversationIdForTurn,
      outcome: "escalated",
      iterationCount: 0,
      toolCalls: [],
      latencyMs: Date.now() - startedAt,
      model: nluModel,
    });
    return { conversationId: conversationIdForTurn, reply: decision.reply, toolCalls: [] };
  }

  if (decision.kind === "escalate_to_staff") {
    const escalated = await applyEscalationSideEffect(clinicId, conversationIdForTurn, decision.reason);
    if (escalated) {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationIdForTurn,
        role: "assistant",
        content: decision.reply,
      });
      await recordTurnEvent(supabase, {
        clinicId,
        conversationId: conversationIdForTurn,
        outcome: "escalated",
        iterationCount: 0,
        toolCalls: [],
        latencyMs: Date.now() - startedAt,
        model: nluModel,
      });
      return { conversationId: conversationIdForTurn, reply: decision.reply, toolCalls: [] };
    }
    // escalate_to_staff isn't enabled for this clinic -- fall through to
    // the normal tool-selection loop instead of claiming an escalation
    // that didn't actually happen.
  }

  if (decision.kind === "ask_follow_up" || decision.kind === "reply_directly") {
    await supabase.from("ai_messages").insert({
      conversation_id: conversationIdForTurn,
      role: "assistant",
      content: decision.reply,
    });
    await recordTurnEvent(supabase, {
      clinicId,
      conversationId: conversationIdForTurn,
      outcome: "reply",
      iterationCount: 0,
      toolCalls: [],
      latencyMs: Date.now() - startedAt,
      model: nluModel,
    });
    return { conversationId: conversationIdForTurn, reply: decision.reply, toolCalls: [] };
  }

  // decision.kind === "execute_tool" (or escalate_to_staff fell through
  // above for lack of permission) -- continue to the tool-selection loop.

  const tools = await getToolsForClinic(clinicId);
  const llmTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  const systemPrompt = buildSystemPrompt({ clinicName, nlu, availability, patientProfile, knowledge });
  const model = process.env.ANTHROPIC_API_KEY ? (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5") : "mock";

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
          conversationState,
          availability,
          patientProfile,
          knowledge,
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
