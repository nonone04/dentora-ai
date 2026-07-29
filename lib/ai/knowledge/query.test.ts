import { describe, expect, it, vi } from "vitest";
import { fetchActiveKnowledgeRecords } from "@/lib/ai/knowledge/query";

type Row = Record<string, unknown>;

function makeFilterableSupabase(rows: Row[]) {
  return {
    from(_table: string) {
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
    },
  };
}

const RECORD_ROW: Row = {
  id: "record-1",
  clinic_id: "clinic-1",
  category: "parking",
  title: "Parking",
  content: "Free parking behind the clinic.",
  keywords: ["parking"],
  is_active: true,
  version: 1,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

describe("fetchActiveKnowledgeRecords", () => {
  it("returns parsed active records for the clinic", async () => {
    const supabase = makeFilterableSupabase([
      RECORD_ROW,
      { ...RECORD_ROW, id: "record-2", is_active: false },
      { ...RECORD_ROW, id: "record-3", clinic_id: "other-clinic" },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await fetchActiveKnowledgeRecords(supabase as any, { clinicId: "clinic-1" });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("record-1");
  });

  it("filters by category when given", async () => {
    const supabase = makeFilterableSupabase([RECORD_ROW, { ...RECORD_ROW, id: "record-2", category: "insurance" }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await fetchActiveKnowledgeRecords(supabase as any, { clinicId: "clinic-1", category: "insurance" });

    expect(records).toHaveLength(1);
    expect(records[0].category).toBe("insurance");
  });

  it("returns an empty array (not throw) when the query fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = { from: () => ({ select: () => { throw new Error("connection reset"); } }) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(fetchActiveKnowledgeRecords(supabase as any, { clinicId: "clinic-1" })).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns an empty array when there are no active records", async () => {
    const supabase = makeFilterableSupabase([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await fetchActiveKnowledgeRecords(supabase as any, { clinicId: "clinic-1" });
    expect(records).toEqual([]);
  });
});
