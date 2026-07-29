import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TableResult = { data: unknown; error: unknown };
type Row = Record<string, unknown> & { conversation_id: string; version: number };

/** Generic static-canned-response builder, same shape as lib/ai/orchestrator.test.ts's fake -- used for every table except conversation_states. */
function makeStaticBuilder(result: TableResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "order", "limit", "update", "gte", "lte", "lt", "gt", "insert"]) {
    builder[method] = () => builder;
  }
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

/** A real (small) in-memory conversation_states table -- insert + CAS-update semantics, same as lib/ai/state/store.test.ts's fake, so persistence genuinely happens rather than always no-op-ing through the default fallback. */
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
      const id = insertPayload.conversation_id;
      if (rows.has(id)) return Promise.resolve({ data: null, error: { message: "duplicate key" } });
      rows.set(id, { ...insertPayload });
      return Promise.resolve({ data: rows.get(id), error: null });
    }
    if (mode === "update" && updatePayload) {
      const id = eqFilters.conversation_id as string;
      const existing = rows.get(id);
      if (!existing || existing.version !== eqFilters.version) return Promise.resolve({ data: null, error: null });
      const updated: Row = { ...existing, ...updatePayload };
      rows.set(id, updated);
      return Promise.resolve({ data: updated, error: null });
    }
    const id = eqFilters.conversation_id as string;
    const existing = rows.get(id);
    return Promise.resolve({ data: existing ?? null, error: null });
  }

  return builder;
}

let fakeSupabase: { from: (table: string) => unknown };
let conversationStatesRows: Map<string, Row>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

vi.mock("@/lib/ai/tools", () => ({
  getToolsForClinic: vi.fn(),
  executeTool: vi.fn(),
}));

const { runConversationTurn } = await import("@/lib/ai/orchestrator");
const { getToolsForClinic, executeTool } = await import("@/lib/ai/tools");
const getToolsForClinicMock = vi.mocked(getToolsForClinic);
const executeToolMock = vi.mocked(executeTool);

const CLINIC = {
  name: "Test Clinic",
  default_language: "fr",
  settings: { ai: { enabled: true, allowedActions: ["check_availability"] } },
};

function setUp(userMessage: string) {
  conversationStatesRows = new Map();

  const staticResults: Record<string, TableResult> = {
    ai_conversations: { data: { id: "conv-1", clinic_id: "clinic-1" }, error: null },
    ai_messages: { data: [{ role: "user", content: userMessage, ai_action: null }], error: null },
    clinics: { data: CLINIC, error: null },
  };

  fakeSupabase = {
    from: (table: string) =>
      table === "conversation_states"
        ? makeConversationStatesBuilder(conversationStatesRows)
        : makeStaticBuilder(staticResults[table] ?? { data: null, error: null }),
  };

  getToolsForClinicMock.mockResolvedValue([
    { name: "check_availability", requiredAction: "check_availability", description: "d", inputSchema: { type: "object", properties: {} }, execute: async () => ({}) },
  ]);
  executeToolMock.mockResolvedValue({ date: "2026-07-29", dentists: [] });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runConversationTurn: Conversation State Engine wiring", () => {
  it("persists conversation state and exposes it to tool execution", async () => {
    setUp("What slots are available tomorrow?");

    await runConversationTurn({
      clinicId: "clinic-1",
      channel: "web_chat",
      userMessage: "What slots are available tomorrow?",
    });

    expect(executeToolMock).toHaveBeenCalledTimes(1);
    const [, , context] = executeToolMock.mock.calls[0];
    expect(context.conversationState).toBeDefined();
    expect(context.conversationState?.intent).toBe("check_availability");
    expect(context.conversationState?.entities.date).not.toBeNull();
    expect(context.conversationState?.turnCount).toBe(1);
    expect(context.conversationState?.status).toBe("ready");

    // And it was actually persisted, not just held in memory for this turn.
    const persisted = conversationStatesRows.get("conv-1");
    expect(persisted).toBeDefined();
    expect(persisted?.version).toBe(1);
    expect(persisted?.intent).toBe("check_availability");
  });

  it("accumulates state across turns of the same conversation", async () => {
    setUp("I'd like to book a cleaning");
    getToolsForClinicMock.mockResolvedValue([]);

    await runConversationTurn({
      clinicId: "clinic-1",
      conversationId: "conv-1",
      channel: "web_chat",
      userMessage: "I'd like to book a cleaning",
    });

    const afterTurn1 = conversationStatesRows.get("conv-1");
    expect(afterTurn1?.entities).toMatchObject({ service: "cleaning" });
    expect(afterTurn1?.version).toBe(1);

    // Second turn only mentions the date -- the previously-known service must survive the merge.
    fakeSupabase = {
      from: (table: string) =>
        table === "conversation_states"
          ? makeConversationStatesBuilder(conversationStatesRows)
          : makeStaticBuilder(
              {
                ai_conversations: { data: { id: "conv-1", clinic_id: "clinic-1" }, error: null },
                ai_messages: { data: [{ role: "user", content: "tomorrow", ai_action: null }], error: null },
                clinics: { data: CLINIC, error: null },
              }[table] ?? { data: null, error: null },
            ),
    };

    await runConversationTurn({
      clinicId: "clinic-1",
      conversationId: "conv-1",
      channel: "web_chat",
      userMessage: "tomorrow",
    });

    const afterTurn2 = conversationStatesRows.get("conv-1");
    expect(afterTurn2?.version).toBe(2);
    expect(afterTurn2?.entities).toMatchObject({ service: "cleaning", date: expect.any(String) });
  });
});
