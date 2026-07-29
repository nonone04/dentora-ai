import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type TableResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; args: unknown[] };

function makeRecordingStaticBuilder(table: string, result: TableResult, calls: RecordedCall[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "order", "limit", "update", "gte", "lte", "lt", "gt"]) {
    builder[method] = () => builder;
  }
  builder.insert = (...args: unknown[]) => {
    calls.push({ table, args });
    return builder;
  };
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

/** Backs onto the given live array so an insert is visible to later queries against the same table. */
function makeFilterableBuilder(rows: Row[], calls?: RecordedCall[], tableName?: string) {
  let filtered = [...rows];
  const builder = {
    select() {
      return builder;
    },
    insert(payload: Row) {
      const inserted = { id: `generated-${rows.length + 1}`, ...payload };
      rows.push(inserted);
      filtered = [inserted];
      if (calls && tableName) calls.push({ table: tableName, args: [payload] });
      return builder;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: filtered[0] ?? null, error: null });
    },
    single() {
      return Promise.resolve({ data: filtered[0] ?? null, error: null });
    },
    then(onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function makeConversationStatesBuilder(rows: Map<string, Row>) {
  let mode: "select" | "insert" | "update" | null = null;
  let insertPayload: Row | null = null;
  let updatePayload: Record<string, unknown> | null = null;
  const eqFilters: Record<string, unknown> = {};

  const builder = {
    select() {
      if (mode === null) mode = "select";
      return builder;
    },
    insert(payload: Row) {
      mode = "insert";
      insertPayload = payload;
      return builder;
    },
    update(payload: Record<string, unknown>) {
      mode = "update";
      updatePayload = payload;
      return builder;
    },
    eq(column: string, value: unknown) {
      eqFilters[column] = value;
      return builder;
    },
    maybeSingle() {
      return execute();
    },
    then(onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) {
      return execute().then(onFulfilled, onRejected);
    },
  };

  function execute(): Promise<TableResult> {
    if (mode === "insert" && insertPayload) {
      const id = insertPayload.conversation_id as string;
      if (rows.has(id)) return Promise.resolve({ data: null, error: { message: "duplicate key" } });
      rows.set(id, { ...insertPayload });
      return Promise.resolve({ data: rows.get(id), error: null });
    }
    if (mode === "update" && updatePayload) {
      const id = eqFilters.conversation_id as string;
      const existing = rows.get(id);
      if (!existing || existing.version !== eqFilters.version) return Promise.resolve({ data: null, error: null });
      const updated = { ...existing, ...updatePayload };
      rows.set(id, updated);
      return Promise.resolve({ data: updated, error: null });
    }
    const id = eqFilters.conversation_id as string;
    return Promise.resolve({ data: rows.get(id) ?? null, error: null });
  }

  return builder;
}

const SCHEDULE_TABLES = ["dentists", "dentist_working_hours", "dentist_time_off", "appointments", "services"];

let fakeSupabase: { from: (table: string) => unknown };
let conversationStatesRows: Map<string, Row>;
let calls: RecordedCall[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { runConversationTurn } = await import("@/lib/ai/orchestrator");
const { MockLLMClient } = await import("@/lib/ai/llm/mock-client");

const ALLOWED_CLINIC_SETTINGS = { ai: { enabled: true, allowedActions: [] as string[] } };

const HOURS_RECORD: Row = {
  id: "record-1",
  clinic_id: "clinic-1",
  category: "hours",
  title: "Opening hours",
  content: "We're open Monday to Saturday, 9am-6pm.",
  keywords: ["opening hours", "hours"],
  is_active: true,
  version: 1,
};

function setUp(userMessage: string, knowledgeRecords: Row[] = []) {
  conversationStatesRows = new Map();
  calls = [];
  const conversationRows: Row[] = [];
  const knowledgeSearchCalls: RecordedCall[] = calls;

  const staticResults: Record<string, TableResult> = {
    ai_messages: { data: [{ role: "user", content: userMessage, ai_action: null }], error: null },
    clinics: { data: { name: "Test Clinic", default_language: "en", is_active: true, settings: ALLOWED_CLINIC_SETTINGS }, error: null },
  };

  fakeSupabase = {
    from: (table: string) => {
      if (table === "conversation_states") return makeConversationStatesBuilder(conversationStatesRows);
      if (table === "ai_conversations") return makeFilterableBuilder(conversationRows);
      if (table === "clinic_knowledge_records") return makeFilterableBuilder([...knowledgeRecords]);
      if (table === "clinic_knowledge_searches") return makeFilterableBuilder([], knowledgeSearchCalls, "clinic_knowledge_searches");
      if (SCHEDULE_TABLES.includes(table)) return makeFilterableBuilder([]);
      if (table === "ai_messages" || table === "clinics") return makeRecordingStaticBuilder(table, staticResults[table], calls);
      // patients, ai_nlu_extractions, ai_decisions, ai_turn_events, ai_availability_queries, patient_activity_events, patient_profiles -- generic insert-recording, empty reads.
      return makeRecordingStaticBuilder(table, { data: null, error: null }, calls);
    },
  };
}

function insertedInto(table: string) {
  return calls.filter((call) => call.table === table).map((call) => call.args[0]);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runConversationTurn: Clinic Knowledge Engine wiring", () => {
  it("grounds the system prompt with matched knowledge on a hit", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUp("What are your opening hours?", [HOURS_RECORD]);

    await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: "What are your opening hours?" });

    expect(completeSpy).toHaveBeenCalledTimes(1);
    const systemPrompt = completeSpy.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain("# Clinic knowledge");
    expect(systemPrompt).toContain("We're open Monday to Saturday, 9am-6pm.");
    expect(systemPrompt).toContain("Answer using only the records below");

    const searches = insertedInto("clinic_knowledge_searches") as { hit: boolean }[];
    expect(searches).toHaveLength(1);
    expect(searches[0].hit).toBe(true);
  });

  it("grounds the system prompt with an explicit fallback on a miss", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUp("Do you offer teeth whitening?", [HOURS_RECORD]);

    await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: "Do you offer teeth whitening?" });

    const systemPrompt = completeSpy.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain("# Clinic knowledge");
    expect(systemPrompt).toContain("No documented knowledge matched");
    expect(systemPrompt).toContain("don't have that information");

    const searches = insertedInto("clinic_knowledge_searches") as { hit: boolean }[];
    expect(searches[0].hit).toBe(false);
  });

  it("does not run retrieval at all for a non-knowledge-relevant intent", async () => {
    setUp("I'd like to book a cleaning for 2026-08-10", [HOURS_RECORD]);

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: "I'd like to book a cleaning for 2026-08-10",
    });

    expect(insertedInto("clinic_knowledge_searches")).toHaveLength(0);
  });
});
