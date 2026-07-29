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

/** Backs onto the given live array (not a copy) so an insert through this builder is visible to later queries against the same table. */
function makeFilterableBuilder(rows: Row[]) {
  let filtered = [...rows];
  let insertedRow: Row | null = null;

  const builder = {
    select() {
      return builder;
    },
    insert(payload: Row) {
      insertedRow = { id: `generated-${rows.length + 1}`, ...payload };
      rows.push(insertedRow);
      filtered = [insertedRow];
      return builder;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
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

function makeProfilesBuilder(rows: Map<string, Row>) {
  let mode: "select" | "insert" | "update" | null = null;
  let insertPayload: Row | null = null;
  let updatePayload: Record<string, unknown> | null = null;
  const eqFilters: Record<string, unknown> = {};

  function key(clinicId: unknown, patientId: unknown) {
    return `${clinicId}:${patientId}`;
  }

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
      const insertKey = key(insertPayload.clinic_id, insertPayload.patient_id);
      if (rows.has(insertKey)) return Promise.resolve({ data: null, error: { message: "duplicate key" } });
      rows.set(insertKey, { ...insertPayload });
      return Promise.resolve({ data: rows.get(insertKey), error: null });
    }
    const rowKey = key(eqFilters.clinic_id, eqFilters.patient_id);
    if (mode === "update" && updatePayload) {
      const existing = rows.get(rowKey);
      if (!existing || existing.version !== eqFilters.version) return Promise.resolve({ data: null, error: null });
      const updated = { ...existing, ...updatePayload };
      rows.set(rowKey, updated);
      return Promise.resolve({ data: updated, error: null });
    }
    return Promise.resolve({ data: rows.get(rowKey) ?? null, error: null });
  }

  return builder;
}

const SCHEDULE_TABLES = ["dentists", "dentist_working_hours", "dentist_time_off", "appointments", "services"];

let fakeSupabase: { from: (table: string) => unknown };
let conversationStatesRows: Map<string, Row>;
let profileRows: Map<string, Row>;
let calls: RecordedCall[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { runConversationTurn } = await import("@/lib/ai/orchestrator");
const { MockLLMClient } = await import("@/lib/ai/llm/mock-client");

const ALLOWED_CLINIC_SETTINGS = { ai: { enabled: true, allowedActions: [] as string[] } };

function setUp(userMessage: string) {
  conversationStatesRows = new Map();
  profileRows = new Map();
  calls = [];
  // Backs both the orchestrator's own insert-a-new-conversation call and the
  // patient engine's later channel-history query -- they're the same table.
  const conversationRows: Row[] = [];

  const staticResults: Record<string, TableResult> = {
    ai_messages: { data: [{ role: "user", content: userMessage, ai_action: null }], error: null },
    clinics: { data: { name: "Test Clinic", default_language: "en", is_active: true, settings: ALLOWED_CLINIC_SETTINGS }, error: null },
    patients: { data: { full_name: "Sara Idrissi" }, error: null },
  };

  fakeSupabase = {
    from: (table: string) => {
      if (table === "conversation_states") return makeConversationStatesBuilder(conversationStatesRows);
      if (table === "patient_profiles") return makeProfilesBuilder(profileRows);
      if (table === "ai_conversations") return makeFilterableBuilder(conversationRows);
      if (SCHEDULE_TABLES.includes(table)) return makeFilterableBuilder([]);
      if (table === "ai_messages" || table === "clinics" || table === "patients") {
        return makeRecordingStaticBuilder(table, staticResults[table], calls);
      }
      // patient_activity_events, ai_nlu_extractions, ai_decisions, ai_turn_events, ai_availability_queries -- generic insert-recording, empty reads.
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

describe("runConversationTurn: Patient Intelligence Engine wiring", () => {
  it("logs conversation_started and computes a profile for a known patient's first turn", async () => {
    setUp("What are your opening hours?");

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: "What are your opening hours?",
    });

    const activityInserts = insertedInto("patient_activity_events") as { type: string; patient_id: string }[];
    expect(activityInserts.some((row) => row.type === "conversation_started" && row.patient_id === "patient-1")).toBe(true);

    expect(profileRows.get("clinic-1:patient-1")).toBeDefined();
    expect(profileRows.get("clinic-1:patient-1")?.version).toBe(1);
  });

  it("grounds the system prompt with the patient's profile once the turn reaches tool selection", async () => {
    const completeSpy = vi.spyOn(MockLLMClient.prototype, "complete");
    setUp("What are your opening hours?");

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      patientId: "patient-1",
      userMessage: "What are your opening hours?",
    });

    expect(completeSpy).toHaveBeenCalledTimes(1);
    const systemPrompt = completeSpy.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain("# Patient context");
    expect(systemPrompt).toContain("No appointment history yet.");
    expect(systemPrompt).toContain("never repeat these verbatim");
  });

  it("does not touch the patient engine at all for an unidentified patient", async () => {
    setUp("What are your opening hours?");

    await runConversationTurn({ clinicId: "clinic-1", channel: "web_chat", userMessage: "What are your opening hours?" });

    expect(insertedInto("patient_activity_events")).toHaveLength(0);
    expect(profileRows.size).toBe(0);
  });
});
