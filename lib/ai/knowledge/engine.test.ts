import { beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveClinicKnowledge } from "@/lib/ai/knowledge/engine";

type Row = Record<string, unknown>;

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
  keywords: ["parking", "park"],
  is_active: true,
  version: 1,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

function makeFakeSupabase(records: Row[]) {
  const searches: Row[] = [];
  const client = {
    from(table: string) {
      if (table === "clinic_knowledge_records") return makeFilterableBuilder(records);
      if (table === "clinic_knowledge_searches") {
        return {
          insert: (payload: Row) => {
            searches.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { client, searches };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("retrieveClinicKnowledge: hit", () => {
  it("returns the ranked matches and logs a hit", async () => {
    const fake = makeFakeSupabase([PARKING_ROW]);

    const result = await retrieveClinicKnowledge(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", query: "Is there parking available?", conversationId: "conv-1" },
    );

    expect(result.hit).toBe(true);
    expect(result.matches[0].record.title).toBe("Parking");

    expect(fake.searches).toHaveLength(1);
    expect(fake.searches[0]).toMatchObject({
      clinic_id: "clinic-1",
      conversation_id: "conv-1",
      hit: true,
      matched_record_ids: ["record-1"],
    });
  });
});

describe("retrieveClinicKnowledge: fallback on miss", () => {
  it("returns hit: false and still logs the attempt for analytics", async () => {
    const fake = makeFakeSupabase([PARKING_ROW]);

    const result = await retrieveClinicKnowledge(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", query: "Do you offer teeth whitening?" },
    );

    expect(result.hit).toBe(false);
    expect(result.matches).toEqual([]);
    expect(fake.searches).toHaveLength(1);
    expect(fake.searches[0]).toMatchObject({ hit: false, matched_record_ids: [], top_score: null });
  });

  it("returns hit: false when the clinic has no knowledge records at all", async () => {
    const fake = makeFakeSupabase([]);
    const result = await retrieveClinicKnowledge(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", query: "anything" },
    );
    expect(result.hit).toBe(false);
  });
});

describe("retrieveClinicKnowledge: resilience", () => {
  it("never throws, even when the underlying query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = { from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.reject(new Error("boom")) }) }) }) };

    await expect(
      retrieveClinicKnowledge(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
        { clinicId: "clinic-1", query: "parking" },
      ),
    ).resolves.toEqual({ query: "parking", category: null, matches: [], hit: false });
  });

  it("respects an explicit category filter end to end", async () => {
    const fake = makeFakeSupabase([PARKING_ROW, { ...PARKING_ROW, id: "record-2", category: "insurance", title: "Insurance", keywords: ["insurance"] }]);

    const result = await retrieveClinicKnowledge(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fake.client as any,
      { clinicId: "clinic-1", query: "parking or insurance", category: "insurance" },
    );

    expect(result.matches.every((match) => match.record.category === "insurance")).toBe(true);
  });
});
