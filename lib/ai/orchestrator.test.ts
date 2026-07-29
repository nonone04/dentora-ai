import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TableResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

/**
 * Minimal fake of the chainable supabase-js query builder -- enough to
 * cover the .select/.eq/.order/.limit/.insert/.update/.single/
 * .maybeSingle/await-as-promise surface the orchestrator (and
 * getToolsForClinic/assertActionAllowed/performEscalation, which it
 * calls into) actually use. Every table not explicitly given a canned
 * result resolves to {data: null, error: null}, which is a safe no-op
 * for the insert-only calls (ai_turn_events, ai_nlu_extractions,
 * ai_decisions, the ai_messages inserts) whose return value the
 * orchestrator never reads.
 */
function createFakeSupabase(tableResults: Record<string, TableResult>) {
  const calls: RecordedCall[] = [];

  function makeBuilder(table: string, result: TableResult) {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "order", "limit", "update", "gte", "lte", "lt", "gt", "insert"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.single = () => Promise.resolve(result);
    builder.maybeSingle = () => Promise.resolve(result);
    builder.then = (onFulfilled: (value: TableResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    return builder;
  }

  return {
    from: (table: string) => makeBuilder(table, tableResults[table] ?? { data: null, error: null }),
    calls,
  };
}

let fakeSupabase: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { runConversationTurn } = await import("@/lib/ai/orchestrator");
const { buildFollowUpQuestion } = await import("@/lib/ai/nlu/follow-up");
const { buildEmergencyReply, buildEscalationReply, buildGreetingReply } = await import("@/lib/ai/decision/replies");
const { MockLLMClient } = await import("@/lib/ai/llm/mock-client");

type ClinicAISettings = { enabled: boolean; allowedActions: string[] };

const BASE_CLINIC = {
  name: "Test Clinic",
  default_language: "fr",
  email: "clinic@example.com",
  settings: { ai: { enabled: false, allowedActions: [] as string[] } as ClinicAISettings },
};

function setUpFakeSupabase(userMessage: string, aiSettings?: Partial<ClinicAISettings>) {
  const clinic = {
    ...BASE_CLINIC,
    settings: { ai: { ...BASE_CLINIC.settings.ai, ...aiSettings } },
  };

  fakeSupabase = createFakeSupabase({
    ai_conversations: { data: { id: "conv-1" }, error: null },
    ai_messages: { data: [{ role: "user", content: userMessage, ai_action: null }], error: null },
    clinics: { data: clinic, error: null },
  });
}

function insertedInto(table: string) {
  return fakeSupabase.calls.filter((call) => call.table === table && call.method === "insert").map((call) => call.args[0]);
}

function updatedInto(table: string) {
  return fakeSupabase.calls.filter((call) => call.table === table && call.method === "update").map((call) => call.args[0]);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runConversationTurn: NLU-driven follow-up short-circuit", () => {
  it("asks only for the missing required fields and never reaches tool selection", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase("I'd like to book an appointment");

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: "I'd like to book an appointment",
    });

    const expectedReply = buildFollowUpQuestion(["date", "service", "patientName"], {
      language: "en",
      clinicDefaultLanguage: "fr",
    });

    expect(result.reply).toBe(expectedReply);
    expect(result.toolCalls).toEqual([]);
    expect(completeSpy).not.toHaveBeenCalled();

    // The follow-up was logged as the assistant's reply...
    const messageInserts = insertedInto("ai_messages") as { role: string; content: string }[];
    expect(messageInserts.some((row) => row.role === "assistant" && row.content === expectedReply)).toBe(true);

    // ...and the NLU extraction, the Decision Engine's verdict, and the turn itself were all recorded for observability.
    const nluInserts = insertedInto("ai_nlu_extractions") as { intent: string; missing_fields: string[] }[];
    expect(nluInserts).toHaveLength(1);
    expect(nluInserts[0].intent).toBe("book_appointment");
    expect(nluInserts[0].missing_fields).toEqual(expect.arrayContaining(["date", "service", "patientName"]));

    const decisionInserts = insertedInto("ai_decisions") as { decision_kind: string; missing_fields: string[] }[];
    expect(decisionInserts).toHaveLength(1);
    expect(decisionInserts[0].decision_kind).toBe("ask_follow_up");
    expect(decisionInserts[0].missing_fields).toEqual(expect.arrayContaining(["date", "service", "patientName"]));

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string; iteration_count: number }[];
    expect(turnInserts).toHaveLength(1);
    expect(turnInserts[0].outcome).toBe("reply");
    expect(turnInserts[0].iteration_count).toBe(0);
  });

  it("does not ask for a patient's name when the conversation already has a known patient", async () => {
    setUpFakeSupabase("Book me a cleaning for 2026-08-05");

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: "Book me a cleaning for 2026-08-05",
    });

    // service + date are both present, and patientId means patientName isn't required -> no missing fields -> falls through
    // to the tool-selection loop (MockLLMClient's placeholder reply, since no tools are enabled for this clinic).
    expect(result.reply.startsWith("[mock]")).toBe(true);
  });
});

describe("runConversationTurn: falls through to tool selection when nothing is missing", () => {
  it("proceeds to the tool-selection loop and passes the structured extraction into the system prompt", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase("What are your opening hours?");

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: "What are your opening hours?",
    });

    expect(completeSpy).toHaveBeenCalledTimes(1);
    const systemPrompt = completeSpy.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain("# Structured understanding of the latest message");
    expect(systemPrompt).toContain("Detected intent: get_clinic_info");
    // Business-rule directives (e.g. urgency -> escalate) are no longer duplicated into the prompt -- the Decision Engine
    // already ruled that out deterministically before this prompt was ever built.
    expect(systemPrompt).not.toContain("Urgency:");

    expect(result.toolCalls).toEqual([]);
    expect(result.reply.startsWith("[mock]")).toBe(true);

    const nluInserts = insertedInto("ai_nlu_extractions") as { intent: string }[];
    expect(nluInserts).toHaveLength(1);
    expect(nluInserts[0].intent).toBe("get_clinic_info");

    const decisionInserts = insertedInto("ai_decisions") as { decision_kind: string }[];
    expect(decisionInserts).toHaveLength(1);
    expect(decisionInserts[0].decision_kind).toBe("execute_tool");
  });
});

describe("runConversationTurn: Decision Engine emergency_workflow", () => {
  const EMERGENCY_MESSAGE = "Emergency! My tooth got knocked out and I can't stop bleeding";

  it("marks the conversation escalated, notifies staff, and replies with the safety message when permitted", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase(EMERGENCY_MESSAGE, { enabled: true, allowedActions: ["escalate_to_staff"] });

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: EMERGENCY_MESSAGE,
    });

    expect(result.reply).toBe(buildEmergencyReply({ language: "en", clinicDefaultLanguage: "fr" }));
    expect(result.toolCalls).toEqual([]);
    expect(completeSpy).not.toHaveBeenCalled();

    expect(updatedInto("ai_conversations")).toEqual([{ status: "escalated" }]);

    const decisionInserts = insertedInto("ai_decisions") as { decision_kind: string }[];
    expect(decisionInserts).toHaveLength(1);
    expect(decisionInserts[0].decision_kind).toBe("emergency_workflow");

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string }[];
    expect(turnInserts[0].outcome).toBe("escalated");
  });

  it("still replies with the safety message even when escalate_to_staff isn't enabled for the clinic", async () => {
    setUpFakeSupabase(EMERGENCY_MESSAGE, { enabled: false, allowedActions: [] });

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: EMERGENCY_MESSAGE,
    });

    // Patient safety guidance is not gated by the clinic's AI settings --
    // but the mutation (marking escalated / notifying staff) is, so it never happened.
    expect(result.reply).toBe(buildEmergencyReply({ language: "en", clinicDefaultLanguage: "fr" }));
    expect(updatedInto("ai_conversations")).toEqual([]);

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string }[];
    expect(turnInserts[0].outcome).toBe("escalated");
  });

  it("takes precedence even when the message would otherwise look like a normal booking request", async () => {
    const message = "I need to book urgently, my tooth was knocked out";
    setUpFakeSupabase(message, { enabled: true, allowedActions: ["escalate_to_staff"] });

    const result = await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: message });

    expect(result.reply).toBe(buildEmergencyReply({ language: "en", clinicDefaultLanguage: "fr" }));
  });
});

describe("runConversationTurn: Decision Engine escalate_to_staff", () => {
  const ESCALATION_MESSAGE = "I want to speak to a human please";

  it("marks the conversation escalated, notifies staff, and returns the acknowledgment reply when permitted", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase(ESCALATION_MESSAGE, { enabled: true, allowedActions: ["escalate_to_staff"] });

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: ESCALATION_MESSAGE,
    });

    expect(result.reply).toBe(buildEscalationReply({ language: "en", clinicDefaultLanguage: "fr" }));
    expect(completeSpy).not.toHaveBeenCalled();
    expect(updatedInto("ai_conversations")).toEqual([{ status: "escalated" }]);

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string }[];
    expect(turnInserts[0].outcome).toBe("escalated");
  });

  it("falls through to the tool-selection loop when the clinic hasn't allowed escalate_to_staff", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase(ESCALATION_MESSAGE, { enabled: true, allowedActions: [] });

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: ESCALATION_MESSAGE,
    });

    // No permission -> no mutation, and the Decision Engine's escalate_to_staff verdict doesn't get to claim
    // an escalation that didn't happen -- falls through to the ordinary tool-selection loop instead.
    expect(updatedInto("ai_conversations")).toEqual([]);
    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(result.reply.startsWith("[mock]")).toBe(true);

    const decisionInserts = insertedInto("ai_decisions") as { decision_kind: string }[];
    expect(decisionInserts[0].decision_kind).toBe("escalate_to_staff");

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string }[];
    expect(turnInserts[0].outcome).toBe("reply");
  });
});

describe("runConversationTurn: Decision Engine reply_directly (greeting)", () => {
  it("answers a bare greeting directly, without invoking the tool-selection model", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUpFakeSupabase("Hello!");

    const result = await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: "Hello!" });

    expect(result.reply).toBe(buildGreetingReply({ language: "en", clinicDefaultLanguage: "fr" }));
    expect(result.toolCalls).toEqual([]);
    expect(completeSpy).not.toHaveBeenCalled();

    const decisionInserts = insertedInto("ai_decisions") as { decision_kind: string }[];
    expect(decisionInserts[0].decision_kind).toBe("reply_directly");

    const turnInserts = insertedInto("ai_turn_events") as { outcome: string; iteration_count: number }[];
    expect(turnInserts[0].outcome).toBe("reply");
    expect(turnInserts[0].iteration_count).toBe(0);
  });
});
