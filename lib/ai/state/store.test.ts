import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyIncrementalUpdate, loadConversationState } from "@/lib/ai/state/store";
import { EMPTY_ENTITIES, type NLUExtraction } from "@/lib/ai/nlu/types";
import { STATE_TTL_MS } from "@/lib/ai/state/expiration";

function makeNLU(overrides: Partial<NLUExtraction> = {}): NLUExtraction {
  return {
    intent: "other",
    entities: { ...EMPTY_ENTITIES },
    urgency: "low",
    language: "en",
    confidence: 0.8,
    missingFields: [],
    rawMessage: "hello",
    ...overrides,
  };
}

type Row = Record<string, unknown> & { conversation_id: string; clinic_id: string; version: number };

/**
 * A faithful-enough in-memory simulation of the conversation_states
 * table: real insert/unique-conflict and update/CAS-version semantics,
 * so store.ts's optimistic-concurrency retry loop can be exercised
 * against genuine version mismatches rather than a hand-waved stub.
 */
function createFakeConversationStatesTable() {
  const rows = new Map<string, Row>();
  let updateInterceptor: ((row: Row) => Row) | null = null;
  let interceptorPersistent = false;
  let updateAttempts = 0;
  let throwOnNextSelect = false;

  function makeBuilder() {
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
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    function execute(): Promise<{ data: unknown; error: unknown }> {
      if (mode === "select" && throwOnNextSelect) {
        throwOnNextSelect = false;
        throw new Error("simulated network failure");
      }

      if (mode === "insert" && insertPayload) {
        const id = insertPayload.conversation_id;
        if (rows.has(id)) {
          return Promise.resolve({ data: null, error: { message: "duplicate key value violates unique constraint" } });
        }
        rows.set(id, { ...insertPayload });
        return Promise.resolve({ data: rows.get(id), error: null });
      }

      if (mode === "update" && updatePayload) {
        updateAttempts += 1;
        const id = eqFilters.conversation_id as string;
        let existing = rows.get(id);

        if (updateInterceptor && existing) {
          existing = updateInterceptor(existing);
          rows.set(id, existing);
          if (!interceptorPersistent) updateInterceptor = null;
        }

        if (!existing) return Promise.resolve({ data: null, error: null });
        if ("version" in eqFilters && existing.version !== eqFilters.version) {
          return Promise.resolve({ data: null, error: null });
        }

        const updated: Row = { ...existing, ...updatePayload };
        rows.set(id, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      // select
      const id = eqFilters.conversation_id as string;
      const clinicId = eqFilters.clinic_id as string | undefined;
      const existing = rows.get(id);
      if (!existing) return Promise.resolve({ data: null, error: null });
      if (clinicId !== undefined && existing.clinic_id !== clinicId) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: existing, error: null });
    }

    return builder;
  }

  return {
    client: { from: (table: string) => (table === "conversation_states" ? makeBuilder() : makeBuilder()) },
    rows,
    get updateAttempts() {
      return updateAttempts;
    },
    interceptNextUpdate(mutator: (row: Row) => Row) {
      updateInterceptor = mutator;
      interceptorPersistent = false;
    },
    interceptEveryUpdate(mutator: (row: Row) => Row) {
      updateInterceptor = mutator;
      interceptorPersistent = true;
    },
    forceNextSelectToThrow() {
      throwOnNextSelect = true;
    },
    seed(row: Row) {
      rows.set(row.conversation_id, row);
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadConversationState", () => {
  it("returns a fresh state when no row exists yet", async () => {
    const fake = createFakeConversationStatesTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await loadConversationState(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(state.status).toBe("active");
    expect(state.version).toBe(0);
    expect(state.turnCount).toBe(0);
  });

  it("returns the parsed, persisted row when one exists and is fresh", async () => {
    const fake = createFakeConversationStatesTable();
    fake.seed({
      clinic_id: "clinic-1",
      conversation_id: "conv-1",
      status: "collecting",
      intent: "book_appointment",
      entities: { ...EMPTY_ENTITIES, service: "cleaning" },
      urgency: "low",
      language: "en",
      confidence: 0.7,
      missing_fields: ["date"],
      turn_count: 1,
      last_message: "book a cleaning",
      version: 1,
      last_activity_at: new Date().toISOString(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await loadConversationState(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(state.status).toBe("collecting");
    expect(state.intent).toBe("book_appointment");
    expect(state.entities.service).toBe("cleaning");
    expect(state.version).toBe(1);
  });

  it("discards an expired row and returns a fresh state (recovery via expiration)", async () => {
    const fake = createFakeConversationStatesTable();
    fake.seed({
      clinic_id: "clinic-1",
      conversation_id: "conv-1",
      status: "collecting",
      intent: "book_appointment",
      entities: { ...EMPTY_ENTITIES, service: "cleaning" },
      urgency: "low",
      language: "en",
      confidence: 0.7,
      missing_fields: [],
      turn_count: 5,
      last_message: "book a cleaning",
      version: 5,
      last_activity_at: new Date(Date.now() - (STATE_TTL_MS + 60_000)).toISOString(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await loadConversationState(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(state.status).toBe("active");
    expect(state.turnCount).toBe(0);
    expect(state.entities.service).toBeNull();
    expect(state.version).toBe(0);
  });

  it("recovers with a fresh state when the query itself fails (interruption)", async () => {
    const fake = createFakeConversationStatesTable();
    fake.forceNextSelectToThrow();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = await loadConversationState(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(state.status).toBe("active");
    expect(state.version).toBe(0);
  });
});

describe("applyIncrementalUpdate", () => {
  it("inserts a brand-new state on the first turn", async () => {
    const fake = createFakeConversationStatesTable();

    const state = await applyIncrementalUpdate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      {
        clinicId: "clinic-1",
        conversationId: "conv-1",
        nlu: makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }),
        decisionKind: "ask_follow_up",
      },
    );

    expect(state.version).toBe(1);
    expect(state.status).toBe("collecting");
    expect(state.entities.service).toBe("cleaning");
    expect(state.turnCount).toBe(1);
    expect(fake.rows.get("conv-1")?.version).toBe(1);
  });

  it("accumulates entities across successive turns and bumps the version each time", async () => {
    const fake = createFakeConversationStatesTable();
    const params = { clinicId: "clinic-1", conversationId: "conv-1" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;

    const afterTurn1 = await applyIncrementalUpdate(client, {
      ...params,
      nlu: makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }),
      decisionKind: "ask_follow_up",
    });
    expect(afterTurn1.version).toBe(1);

    const afterTurn2 = await applyIncrementalUpdate(client, {
      ...params,
      nlu: makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }),
      decisionKind: "ask_follow_up",
    });
    expect(afterTurn2.version).toBe(2);
    expect(afterTurn2.entities.service).toBe("cleaning");
    expect(afterTurn2.entities.date).toBe("2026-08-05");
    expect(afterTurn2.turnCount).toBe(2);

    const afterTurn3 = await applyIncrementalUpdate(client, {
      ...params,
      nlu: makeNLU({ entities: { ...EMPTY_ENTITIES, patientName: "Sara Idrissi" } }),
      decisionKind: "execute_tool",
    });
    expect(afterTurn3.version).toBe(3);
    expect(afterTurn3.status).toBe("ready");
    expect(afterTurn3.entities).toMatchObject({ service: "cleaning", date: "2026-08-05", patientName: "Sara Idrissi" });
  });

  it("applies the status transition for the decision made this turn", async () => {
    const fake = createFakeConversationStatesTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;

    const escalated = await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ urgency: "emergency" }),
      decisionKind: "emergency_workflow",
    });
    expect(escalated.status).toBe("escalated");

    // A follow-up next turn should not un-escalate it.
    const stillEscalated = await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ intent: "book_appointment" }),
      decisionKind: "ask_follow_up",
    });
    expect(stillEscalated.status).toBe("escalated");
  });

  it("retries and reconciles when a concurrent turn updates the same conversation first", async () => {
    const fake = createFakeConversationStatesTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;

    await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }),
      decisionKind: "ask_follow_up",
    });
    // version is now 1 in storage.

    // Simulate another turn (e.g. a duplicate webhook delivery) landing a
    // write in between this call's load and its own CAS update.
    fake.interceptNextUpdate((row) => ({
      ...row,
      version: row.version + 1,
      entities: { ...(row.entities as object), dentist: "Dr. Amrani" },
    }));

    const result = await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }),
      decisionKind: "ask_follow_up",
    });

    // Nothing was lost: the concurrent writer's field and this turn's own field both made it through.
    expect(result.entities).toMatchObject({ service: "cleaning", dentist: "Dr. Amrani", date: "2026-08-05" });
    expect(fake.updateAttempts).toBe(2); // one lost race, one successful retry
  });

  it("gives up after bounded retries and returns an unpersisted local merge instead of blocking the turn", async () => {
    const fake = createFakeConversationStatesTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }),
      decisionKind: "ask_follow_up",
    });

    // Every subsequent update loses the race, forever.
    fake.interceptEveryUpdate((row) => ({ ...row, version: row.version + 1 }));

    const result = await applyIncrementalUpdate(client, {
      clinicId: "clinic-1",
      conversationId: "conv-1",
      nlu: makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }),
      decisionKind: "ask_follow_up",
    });

    expect(result.entities.date).toBe("2026-08-05");
    // The seed call was an insert (not counted here); this call exhausts exactly MAX_PERSIST_ATTEMPTS (2) update attempts.
    expect(fake.updateAttempts).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("giving up on persisting"));
  });

  it("never throws even when persistence fails outright", async () => {
    const fake = createFakeConversationStatesTable();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fake.forceNextSelectToThrow();

    await expect(
      applyIncrementalUpdate(client, {
        clinicId: "clinic-1",
        conversationId: "conv-1",
        nlu: makeNLU({ intent: "greeting" }),
        decisionKind: "reply_directly",
      }),
    ).resolves.toBeDefined();
  });
});
