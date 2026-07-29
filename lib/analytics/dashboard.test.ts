import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDateRange, getDashboardSummary } from "@/lib/analytics/dashboard";

type Row = Record<string, unknown>;

function makeListBuilder(rows: Row[]) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return b;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("defaultDateRange", () => {
  it("spans the last 30 days ending at the given time", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    const range = defaultDateRange(now);
    expect(range.to).toBe(now.toISOString());
    expect(new Date(range.from).getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });
});

describe("getDashboardSummary", () => {
  it("fetches raw data and runs every aggregator, producing a complete summary", async () => {
    const client = {
      from: (table: string) => {
        if (table === "appointments") return makeListBuilder([{ status: "completed", source: "ai_assistant" }, { status: "cancelled", source: "staff" }]);
        if (table === "ai_turn_events") return makeListBuilder([{ outcome: "reply", latency_ms: 120 }]);
        if (table === "ai_decisions") return makeListBuilder([{ decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 }]);
        if (table === "notification_deliveries") return makeListBuilder([{ status: "sent", channel: "email", attempts: 1 }]);
        if (table === "patient_profiles")
          return makeListBuilder([{ reliability_label: "good", reliability_score: 0.8, preferred_channel: "email", created_at: "2026-07-10T00:00:00.000Z" }]);
        throw new Error(`unexpected table: ${table}`);
      },
    };

    const range = { from: "2026-07-01T00:00:00.000Z", to: "2026-07-27T00:00:00.000Z" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await getDashboardSummary(client as any, { clinicId: "clinic-1", range });

    expect(summary.clinicId).toBe("clinic-1");
    expect(summary.range).toEqual(range);
    expect(summary.appointments.total).toBe(2);
    expect(summary.aiResolution.totalDecisions).toBe(1);
    expect(summary.notifications.total).toBe(1);
    expect(summary.patientBehavior.totalPatients).toBe(1);
    expect(summary.generatedAt).toEqual(expect.any(String));
  });

  it("uses the default 30-day range when none is given", async () => {
    const client = { from: () => makeListBuilder([]) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await getDashboardSummary(client as any, { clinicId: "clinic-1" });
    expect(summary.range.from < summary.range.to).toBe(true);
  });
});
