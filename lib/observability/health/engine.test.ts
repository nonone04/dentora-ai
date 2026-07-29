import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemHealth } from "@/lib/observability/health/engine";

type Row = Record<string, unknown>;

function makeListBuilder(rows: Row[]) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return b;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getSystemHealth", () => {
  it("combines all three components into one overall status (the worst of them)", async () => {
    const client = {
      from: (table: string) => {
        if (table === "ai_turn_events") return makeListBuilder(Array.from({ length: 20 }, () => ({ outcome: "reply", latency_ms: 50 })));
        if (table === "ai_decisions") return makeListBuilder(Array.from({ length: 20 }, () => ({ decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 })));
        if (table === "notification_deliveries")
          return makeListBuilder([
            ...Array.from({ length: 8 }, () => ({ status: "failed", channel: "email", attempts: 5 })),
            ...Array.from({ length: 2 }, () => ({ status: "sent", channel: "email", attempts: 1 })),
          ]); // 80% failure -- unhealthy
        if (table === "clinic_knowledge_searches") return makeListBuilder(Array.from({ length: 10 }, () => ({ hit: true })));
        throw new Error(`unexpected table: ${table}`);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const health = await getSystemHealth(client as any, { clinicId: "clinic-1" });

    expect(health.clinicId).toBe("clinic-1");
    expect(health.status).toBe("unhealthy"); // driven by notifications
    expect(health.components.map((c) => c.component)).toEqual(["ai_orchestrator", "notifications", "clinic_knowledge"]);
    expect(health.components.find((c) => c.component === "notifications")?.status).toBe("unhealthy");
    expect(health.components.find((c) => c.component === "ai_orchestrator")?.status).toBe("healthy");
    expect(health.windowHours).toBe(24);
    expect(health.generatedAt).toEqual(expect.any(String));
  });

  it("respects a custom windowHours", async () => {
    const client = { from: () => makeListBuilder([]) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const health = await getSystemHealth(client as any, { clinicId: "clinic-1", windowHours: 6 });
    expect(health.windowHours).toBe(6);
    expect(health.status).toBe("healthy"); // no data -- below every MIN_SAMPLE_SIZE
  });
});
