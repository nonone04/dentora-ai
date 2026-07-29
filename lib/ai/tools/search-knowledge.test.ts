import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

function makeStaticBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.insert = () => Promise.resolve({ error: null });
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

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
    then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

const PARKING_ROW: Row = {
  id: "record-1",
  clinic_id: "clinic-1",
  category: "parking",
  title: "Parking",
  content: "Free parking is available behind the clinic.",
  keywords: ["parking"],
  is_active: true,
  version: 1,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const ALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: ["answer_faq"] } } };

let fakeSupabase: { from: (table: string) => unknown };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { searchKnowledgeTool } = await import("@/lib/ai/tools/search-knowledge");

function setUp(records: Row[], clinic: Row = ALLOWED_CLINIC) {
  fakeSupabase = {
    from: (table: string) => {
      if (table === "clinic_knowledge_records") return makeFilterableBuilder(records);
      if (table === "clinics") return makeStaticBuilder({ data: clinic, error: null });
      return makeStaticBuilder({ data: null, error: null }); // clinic_knowledge_searches -- generic insert no-op
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("searchKnowledgeTool", () => {
  it("returns matching records for a relevant query", async () => {
    setUp([PARKING_ROW]);

    const result = (await searchKnowledgeTool.execute({ query: "Is there parking?" }, { clinicId: "clinic-1" })) as {
      hit: boolean;
      matches: { title: string; content: string }[];
    };

    expect(result.hit).toBe(true);
    expect(result.matches[0]).toMatchObject({ title: "Parking", content: "Free parking is available behind the clinic." });
  });

  it("returns hit: false rather than an empty-but-truthy result for an unmatched query", async () => {
    setUp([PARKING_ROW]);
    const result = (await searchKnowledgeTool.execute({ query: "Do you offer braces?" }, { clinicId: "clinic-1" })) as {
      hit: boolean;
      matches: unknown[];
    };
    expect(result).toEqual({ hit: false, matches: [] });
  });

  it("respects an explicit category filter", async () => {
    setUp([PARKING_ROW, { ...PARKING_ROW, id: "record-2", category: "insurance", title: "Insurance", keywords: ["insurance"] }]);

    const result = (await searchKnowledgeTool.execute(
      { query: "insurance or parking", category: "insurance" },
      { clinicId: "clinic-1" },
    )) as { matches: { title: string }[] };

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].title).toBe("Insurance");
  });

  it("ignores an invalid category rather than throwing", async () => {
    setUp([PARKING_ROW]);
    const result = (await searchKnowledgeTool.execute({ query: "parking", category: "not-a-real-category" }, { clinicId: "clinic-1" })) as {
      hit: boolean;
    };
    expect(result.hit).toBe(true);
  });

  it("throws when query is missing", async () => {
    setUp([]);
    await expect(searchKnowledgeTool.execute({}, { clinicId: "clinic-1" })).rejects.toThrow("query is required");
  });

  it("enforces the permission gate", async () => {
    setUp([PARKING_ROW], { id: "clinic-1", is_active: true, settings: { ai: { enabled: false, allowedActions: [] } } });
    await expect(searchKnowledgeTool.execute({ query: "parking" }, { clinicId: "clinic-1" })).rejects.toThrow();
  });
});
