import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardRawData } from "@/lib/analytics/query";

type Row = Record<string, unknown>;

function makeListBuilder(result: { data: Row[] | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled, onRejected);
  return b;
}

function makeRejectingBuilder(error: Error) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise.reject(error).then(onFulfilled, onRejected);
  return b;
}

const RANGE = { from: "2026-07-01T00:00:00.000Z", to: "2026-07-27T00:00:00.000Z" };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchDashboardRawData", () => {
  it("returns rows from every table when all queries succeed", async () => {
    const client = {
      from: (table: string) => {
        if (table === "appointments") return makeListBuilder({ data: [{ status: "completed", source: "staff" }], error: null });
        if (table === "ai_turn_events") return makeListBuilder({ data: [{ outcome: "reply", latency_ms: 100 }], error: null });
        if (table === "ai_decisions") return makeListBuilder({ data: [{ decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 }], error: null });
        if (table === "notification_deliveries") return makeListBuilder({ data: [{ status: "sent", channel: "email", attempts: 1 }], error: null });
        if (table === "patient_profiles") return makeListBuilder({ data: [{ reliability_label: "good", reliability_score: 0.8, preferred_channel: "email", created_at: "2026-07-10T00:00:00.000Z" }], error: null });
        throw new Error(`unexpected table: ${table}`);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchDashboardRawData(client as any, { clinicId: "clinic-1", range: RANGE });

    expect(raw.appointments).toHaveLength(1);
    expect(raw.turnEvents).toHaveLength(1);
    expect(raw.decisions).toHaveLength(1);
    expect(raw.deliveries).toHaveLength(1);
    expect(raw.patientProfiles).toHaveLength(1);
  });

  it("degrades one failing source to an empty array without affecting the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const client = {
      from: (table: string) => {
        if (table === "appointments") return makeRejectingBuilder(new Error("connection reset"));
        if (table === "ai_turn_events") return makeListBuilder({ data: [{ outcome: "reply", latency_ms: 50 }], error: null });
        if (table === "ai_decisions") return makeListBuilder({ data: [], error: { message: "permission denied" } }); // returned error, not thrown
        if (table === "notification_deliveries") return makeListBuilder({ data: [], error: null });
        if (table === "patient_profiles") return makeListBuilder({ data: [], error: null });
        throw new Error(`unexpected table: ${table}`);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchDashboardRawData(client as any, { clinicId: "clinic-1", range: RANGE });

    expect(raw.appointments).toEqual([]); // rejected promise -- degraded
    expect(raw.decisions).toEqual([]); // returned {error} -- degraded
    expect(raw.turnEvents).toHaveLength(1); // unaffected
  });

  it("never throws even when every source fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = { from: () => makeRejectingBuilder(new Error("boom")) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(fetchDashboardRawData(client as any, { clinicId: "clinic-1", range: RANGE })).resolves.toEqual({
      appointments: [],
      turnEvents: [],
      decisions: [],
      deliveries: [],
      patientProfiles: [],
    });
  });
});
