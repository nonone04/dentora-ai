import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveKnowledgeRecord,
  createKnowledgeRecord,
  getKnowledgeRecordHistory,
  listKnowledgeRecords,
  updateKnowledgeRecord,
} from "@/lib/ai/knowledge/store";

type Row = Record<string, unknown>;

/** Real insert/CAS-update in-memory records table, with an RLS simulation switch -- same interceptor-free CAS pattern used throughout lib/ai's other store.test.ts files. */
function makeRecordsTable(options: { permitted?: boolean } = {}) {
  const permitted = options.permitted ?? true;
  const rows = new Map<string, Row>();
  let nextId = 1;
  let insertAttempts = 0;
  let updateAttempts = 0;

  function builder() {
    let mode: "select" | "insert" | "update" | null = null;
    let insertPayload: Row | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};

    const b = {
      select() {
        if (mode === null) mode = "select";
        return b;
      },
      insert(payload: Row) {
        mode = "insert";
        insertPayload = payload;
        return b;
      },
      update(payload: Record<string, unknown>) {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      // .maybeSingle() collapses a select to its first match; insert/update already resolve to a single row either way.
      maybeSingle() {
        if (mode === "select" || mode === null) {
          const candidates = [...rows.values()].filter((row) => matchesFilters(row, eqFilters));
          return Promise.resolve({ data: candidates[0] ?? null, error: null });
        }
        return execute();
      },
      // Plain awaiting (no .maybeSingle()) is how listKnowledgeRecords/getKnowledgeRecordHistory-style multi-row selects read -- they need the full array back, not just the first match.
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    function execute(): Promise<{ data: unknown; error: unknown }> {
      if (mode === "insert" && insertPayload) {
        insertAttempts += 1;
        if (!permitted) return Promise.resolve({ data: null, error: { message: "new row violates row-level security policy" } });
        const id = `record-${nextId++}`;
        // Simulates the real table's `is_active boolean not null default true` -- the store never sets it explicitly on create.
        const row = { id, is_active: true, created_at: "2026-07-20T00:00:00.000Z", updated_at: "2026-07-20T00:00:00.000Z", ...insertPayload };
        rows.set(id, row);
        return Promise.resolve({ data: row, error: null });
      }

      if (mode === "update" && updatePayload) {
        updateAttempts += 1;
        const id = eqFilters.id as string;
        const existing = rows.get(id);
        if (!permitted) return Promise.resolve({ data: null, error: null }); // RLS silently filters -- 0 rows, no explicit error
        if (!existing || !matchesFilters(existing, eqFilters)) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload, updated_at: "2026-07-21T00:00:00.000Z" };
        rows.set(id, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      // select -- the full matching array, for a caller that awaits directly rather than calling .maybeSingle().
      const candidates = [...rows.values()].filter((row) => matchesFilters(row, eqFilters));
      return Promise.resolve({ data: candidates, error: null });
    }

    return b;
  }

  function matchesFilters(row: Row, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  }

  return {
    rows,
    builder,
    get insertAttempts() {
      return insertAttempts;
    },
    get updateAttempts() {
      return updateAttempts;
    },
  };
}

function makeVersionsTable() {
  const versions: Row[] = [];
  function builder() {
    let mode: "select" | "insert" | null = null;
    let insertPayload: Row | null = null;
    const eqFilters: Record<string, unknown> = {};
    let orderDescending = false;

    const b = {
      select() {
        if (mode === null) mode = "select";
        return b;
      },
      insert(payload: Row) {
        mode = "insert";
        insertPayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      order(_column: string, opts?: { ascending?: boolean }) {
        orderDescending = opts?.ascending === false;
        return b;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    function execute(): Promise<{ data: unknown; error: unknown }> {
      if (mode === "insert" && insertPayload) {
        versions.push({ ...insertPayload, created_at: `2026-07-2${versions.length}T00:00:00.000Z` });
        return Promise.resolve({ data: insertPayload, error: null });
      }
      let matches = versions.filter((v) => Object.entries(eqFilters).every(([key, value]) => v[key] === value));
      if (orderDescending) matches = [...matches].sort((a, b2) => (b2.version as number) - (a.version as number));
      return Promise.resolve({ data: matches, error: null });
    }

    return b;
  }

  return { versions, builder };
}

function makeFakeSupabase(params: { permitted?: boolean } = {}) {
  const recordsTable = makeRecordsTable({ permitted: params.permitted });
  const versionsTable = makeVersionsTable();
  const client = {
    from(table: string) {
      if (table === "clinic_knowledge_records") return recordsTable.builder();
      if (table === "clinic_knowledge_record_versions") return versionsTable.builder();
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { client, recordsTable, versionsTable };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createKnowledgeRecord", () => {
  it("creates a new record at version 1 with a matching version snapshot", async () => {
    const fake = makeFakeSupabase();

    const outcome = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "parking", title: "Parking", content: "Free parking behind the clinic.", keywords: ["parking"], actorId: "user-1" },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.version).toBe(1);
    expect(outcome.record.category).toBe("parking");

    expect(fake.versionsTable.versions).toHaveLength(1);
    expect(fake.versionsTable.versions[0]).toMatchObject({
      record_id: outcome.record.id,
      version: 1,
      change_reason: "created",
      changed_by: "user-1",
    });
  });

  it("returns forbidden when RLS rejects the insert (not owner/admin)", async () => {
    const fake = makeFakeSupabase({ permitted: false });

    const outcome = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "faq", title: "x", content: "y", actorId: "user-1" },
    );

    expect(outcome).toEqual({ ok: false, reason: "forbidden" });
    expect(fake.versionsTable.versions).toHaveLength(0);
  });
});

describe("updateKnowledgeRecord: versioning", () => {
  it("bumps the version and writes a new snapshot on a successful update", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "parking", title: "Parking", content: "Free parking.", actorId: "user-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    const outcome = await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      {
        clinicId: "clinic-1",
        recordId: created.record.id,
        expectedVersion: 1,
        patch: { content: "Free parking behind the clinic, spaces 1-10." },
        actorId: "user-2",
        changeReason: "clarified location",
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.version).toBe(2);
    expect(outcome.record.content).toBe("Free parking behind the clinic, spaces 1-10.");
    expect(outcome.record.updatedBy).toBe("user-2");

    expect(fake.versionsTable.versions).toHaveLength(2);
    expect(fake.versionsTable.versions[1]).toMatchObject({ version: 2, change_reason: "clarified location", changed_by: "user-2" });
  });

  it("only patches the fields given, leaving the rest unchanged", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "parking", title: "Parking", content: "Free parking.", keywords: ["parking"], actorId: "user-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    const outcome = await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "Parking info" }, actorId: "user-1" },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.title).toBe("Parking info");
    expect(outcome.record.content).toBe("Free parking."); // untouched
    expect(outcome.record.keywords).toEqual(["parking"]); // untouched
  });

  it("rejects a stale version with a conflict, and writes no new snapshot", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "faq", title: "x", content: "y", actorId: "user-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    // Someone else already updated it to version 2 -- we're still trying against version 1.
    await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "Someone else's edit" }, actorId: "user-2" },
    );

    const outcome = await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "My stale edit" }, actorId: "user-1" },
    );

    expect(outcome).toEqual({ ok: false, reason: "conflict" });
    expect(fake.versionsTable.versions).toHaveLength(2); // create + the one successful update, not a third
  });

  it("does not auto-retry a conflict -- a human editor should decide, not the engine", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "faq", title: "x", content: "y", actorId: "user-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "First edit" }, actorId: "user-1" },
    );

    await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "Stale edit" }, actorId: "user-2" },
    );

    // Exactly two update attempts happened -- one succeeded, one failed -- no silent retry loop.
    expect(fake.recordsTable.updateAttempts).toBe(2);
  });

  it("returns not_found for a nonexistent record", async () => {
    const fake = makeFakeSupabase();

    const outcome = await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: "does-not-exist", expectedVersion: 1, patch: { title: "x" }, actorId: "user-1" },
    );

    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("updateKnowledgeRecord: permissions", () => {
  it("returns forbidden when RLS silently blocks the write even though the version matched", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "faq", title: "x", content: "y", actorId: "owner-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    // Simulate a non-owner/admin staff session by disabling permission on a fresh client sharing the same underlying rows.
    const restrictedClient = {
      from: (table: string) => {
        if (table === "clinic_knowledge_records") {
          const restricted = makeRecordsTable({ permitted: false });
          // Reuse the already-created row so the version-check read still finds it.
          restricted.rows.set(created.record.id, fake.recordsTable.rows.get(created.record.id)!);
          return restricted.builder();
        }
        return fake.versionsTable.builder();
      },
    };

    const outcome = await updateKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      restrictedClient as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "Attempted edit" }, actorId: "staff-1" },
    );

    expect(outcome).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("archiveKnowledgeRecord", () => {
  it("soft-deletes via isActive: false, versioned like any other update", async () => {
    const fake = makeFakeSupabase();
    const created = await createKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", category: "faq", title: "x", content: "y", actorId: "user-1" },
    );
    if (!created.ok) throw new Error("setup failed");

    const outcome = await archiveKnowledgeRecord(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, actorId: "user-1" },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.isActive).toBe(false);
    expect(outcome.record.version).toBe(2);
    expect(fake.versionsTable.versions[1]).toMatchObject({ change_reason: "archived", is_active: false });
  });
});

describe("listKnowledgeRecords", () => {
  it("lists only active records by default", async () => {
    const fake = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;

    const first = await createKnowledgeRecord(client, { clinicId: "clinic-1", category: "faq", title: "Keep", content: "y", actorId: "user-1" });
    const second = await createKnowledgeRecord(client, { clinicId: "clinic-1", category: "faq", title: "Archive me", content: "y", actorId: "user-1" });
    if (!first.ok || !second.ok) throw new Error("setup failed");
    await archiveKnowledgeRecord(client, { clinicId: "clinic-1", recordId: second.record.id, expectedVersion: 1, actorId: "user-1" });

    const active = await listKnowledgeRecords(client, { clinicId: "clinic-1" });
    expect(active.map((r) => r.title)).toEqual(["Keep"]);

    const all = await listKnowledgeRecords(client, { clinicId: "clinic-1", includeInactive: true });
    expect(all.map((r) => r.title).sort()).toEqual(["Archive me", "Keep"]);
  });

  it("filters by category", async () => {
    const fake = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;
    await createKnowledgeRecord(client, { clinicId: "clinic-1", category: "parking", title: "Parking", content: "y", actorId: "user-1" });
    await createKnowledgeRecord(client, { clinicId: "clinic-1", category: "insurance", title: "Insurance", content: "y", actorId: "user-1" });

    const records = await listKnowledgeRecords(client, { clinicId: "clinic-1", category: "insurance" });
    expect(records.map((r) => r.title)).toEqual(["Insurance"]);
  });
});

describe("getKnowledgeRecordHistory", () => {
  it("returns every version, newest first", async () => {
    const fake = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;
    const created = await createKnowledgeRecord(client, { clinicId: "clinic-1", category: "faq", title: "v1", content: "y", actorId: "user-1" });
    if (!created.ok) throw new Error("setup failed");
    await updateKnowledgeRecord(client, { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 1, patch: { title: "v2" }, actorId: "user-1" });
    await updateKnowledgeRecord(client, { clinicId: "clinic-1", recordId: created.record.id, expectedVersion: 2, patch: { title: "v3" }, actorId: "user-1" });

    const history = await getKnowledgeRecordHistory(client, { clinicId: "clinic-1", recordId: created.record.id });

    expect(history.map((v) => v.title)).toEqual(["v3", "v2", "v1"]);
    expect(history.map((v) => v.version)).toEqual([3, 2, 1]);
  });
});
