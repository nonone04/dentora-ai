import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHealthRawData } from "@/lib/observability/health/query";

type Row = Record<string, unknown>;

function makeListBuilder(result: { data: Row[] | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled, onRejected);
  return b;
}

function makeRejectingBuilder(error: Error) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise.reject(error).then(onFulfilled, onRejected);
  return b;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchHealthRawData", () => {
  it("returns rows from every source when all queries succeed", async () => {
    const client = {
      from: (table: string) => {
        if (table === "ai_turn_events") return makeListBuilder({ data: [{ outcome: "reply", latency_ms: 100 }], error: null });
        if (table === "ai_decisions") return makeListBuilder({ data: [{ decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 }], error: null });
        if (table === "notification_deliveries") return makeListBuilder({ data: [{ status: "sent", channel: "email", attempts: 1 }], error: null });
        if (table === "clinic_knowledge_searches") return makeListBuilder({ data: [{ hit: true }], error: null });
        throw new Error(`unexpected table: ${table}`);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchHealthRawData(client as any, { clinicId: "clinic-1", sinceIso: "2026-07-26T00:00:00.000Z" });

    expect(raw.turnEvents).toHaveLength(1);
    expect(raw.decisions).toHaveLength(1);
    expect(raw.deliveries).toHaveLength(1);
    expect(raw.knowledgeSearches).toHaveLength(1);
  });

  it("degrades a failing source to an empty array", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = {
      from: (table: string) => {
        if (table === "ai_turn_events") return makeRejectingBuilder(new Error("boom"));
        return makeListBuilder({ data: [], error: null });
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchHealthRawData(client as any, { clinicId: "clinic-1", sinceIso: "2026-07-26T00:00:00.000Z" });
    expect(raw.turnEvents).toEqual([]);
  });
});
