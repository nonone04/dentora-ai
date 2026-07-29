import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type TableResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; args: unknown[] };

/** Static canned response, recording every insert for later assertions -- same pattern as lib/ai/orchestrator.test.ts's fake. */
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

/** A real, generic in-memory filterable table -- used for dentists/working-hours/time-off/appointments/services, which the Availability Engine actually needs to filter meaningfully. */
function makeFilterableBuilder(rows: Row[]) {
  let filtered = [...rows];
  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      return builder;
    },
    neq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] !== value);
      return builder;
    },
    lte(column: string, value: unknown) {
      filtered = filtered.filter((row) => (row[column] as string) <= (value as string));
      return builder;
    },
    gte(column: string, value: unknown) {
      filtered = filtered.filter((row) => (row[column] as string) >= (value as string));
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: filtered[0] ?? null, error: null });
    },
    then(onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

/** Real insert/CAS-update conversation_states table -- see lib/ai/state/store.test.ts for the fully-featured version; this is the minimal slice the orchestrator actually exercises in one turn. */
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

vi.mock("@/lib/ai/tools", () => ({
  getToolsForClinic: vi.fn(),
  executeTool: vi.fn(),
}));

const { runConversationTurn } = await import("@/lib/ai/orchestrator");
const { getToolsForClinic, executeTool } = await import("@/lib/ai/tools");
const { MockLLMClient } = await import("@/lib/ai/llm/mock-client");
const getToolsForClinicMock = vi.mocked(getToolsForClinic);
const executeToolMock = vi.mocked(executeTool);

const DATE = "2026-08-10";
const DAY_OF_WEEK = new Date(`${DATE}T00:00:00Z`).getUTCDay();

const ALLOWED_CLINIC_SETTINGS = { ai: { enabled: true, allowedActions: ["check_availability", "book_appointment"] } };

function setUp(userMessage: string, options: { patientId?: string } = {}) {
  conversationStatesRows = new Map();
  calls = [];

  const scheduleData: Record<string, Row[]> = {
    dentists: [{ id: "dentist-a", clinic_id: "clinic-1", full_name: "Dr. Amrani", is_active: true }],
    dentist_working_hours: [{ dentist_id: "dentist-a", day_of_week: DAY_OF_WEEK, start_time: "09:00", end_time: "10:00" }],
    dentist_time_off: [],
    appointments: [],
    services: [{ id: "svc-1", clinic_id: "clinic-1", is_active: true, name_translations: { en: "Cleaning" }, default_duration_minutes: 30 }],
  };

  const staticResults: Record<string, TableResult> = {
    ai_conversations: { data: { id: "conv-1", clinic_id: "clinic-1" }, error: null },
    ai_messages: { data: [{ role: "user", content: userMessage, ai_action: null }], error: null },
    clinics: {
      data: { name: "Test Clinic", default_language: "en", is_active: true, settings: ALLOWED_CLINIC_SETTINGS },
      error: null,
    },
  };

  fakeSupabase = {
    from: (table: string) => {
      if (table === "conversation_states") return makeConversationStatesBuilder(conversationStatesRows);
      if (SCHEDULE_TABLES.includes(table)) return makeFilterableBuilder(scheduleData[table] ?? []);
      return makeRecordingStaticBuilder(table, staticResults[table] ?? { data: null, error: null }, calls);
    },
  };

  getToolsForClinicMock.mockResolvedValue([]);
  executeToolMock.mockResolvedValue({});

  return { patientId: options.patientId };
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

describe("runConversationTurn: Availability Engine wiring", () => {
  it("logs a proactive availability query for an appointment-related turn, even when the decision short-circuits", async () => {
    setUp(`Book me a cleaning for ${DATE}`);

    const result = await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: `Book me a cleaning for ${DATE}`,
    });

    // No patient on file -> the Decision Engine still asks a follow-up (patientName) -- but the
    // Availability Engine already ran and was logged before that short-circuit happened.
    const queries = insertedInto("ai_availability_queries") as { requested_date: string; options_count: number }[];
    expect(queries).toHaveLength(1);
    expect(queries[0].requested_date).toBe(DATE);
    expect(queries[0].options_count).toBeGreaterThan(0);
    expect(result.reply).toBeTruthy();
  });

  it("grounds the system prompt in real availability once the turn reaches tool selection", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUp(`Book me a cleaning for ${DATE}`, { patientId: "patient-1" });

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: `Book me a cleaning for ${DATE}`,
    });

    // service + date known, patient already on file -> nothing missing -> falls through to tool selection.
    expect(completeSpy).toHaveBeenCalledTimes(1);
    const systemPrompt = completeSpy.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain("# Real-time availability");
    expect(systemPrompt).toContain("never invent or guess a time");
    expect(systemPrompt).toContain("Dr. Amrani");
  });

  it("exposes the availability result to tool execution when the LLM actually calls a tool", async () => {
    const message = `What slots are available on ${DATE}?`;
    setUp(message, { patientId: "patient-1" });
    getToolsForClinicMock.mockResolvedValue([
      {
        name: "check_availability",
        requiredAction: "check_availability",
        description: "d",
        inputSchema: { type: "object", properties: {} },
        execute: async () => ({}),
      },
    ]);

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: message,
    });

    expect(executeToolMock).toHaveBeenCalledTimes(1);
    const [, , context] = executeToolMock.mock.calls[0];
    expect(context.availability).toBeDefined();
    expect(context.availability?.query.date).toBe(DATE);
    expect(context.availability?.options.length).toBeGreaterThan(0);
  });

  it("does not query availability for a non-appointment turn", async () => {
    setUp("What are your opening hours?");

    await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: "What are your opening hours?" });

    expect(insertedInto("ai_availability_queries")).toHaveLength(0);
  });
});
