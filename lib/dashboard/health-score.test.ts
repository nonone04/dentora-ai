import { describe, expect, it } from "vitest";
import { computeHealthScore, primaryHealthMetric } from "@/lib/dashboard/health-score";
import type { ComponentHealth } from "@/lib/observability";

function component(overrides: Partial<ComponentHealth>): ComponentHealth {
  return { component: "ai_orchestrator", status: "healthy", metrics: {}, message: "", ...overrides };
}

describe("primaryHealthMetric", () => {
  it("reads avgConfidence for the AI orchestrator", () => {
    expect(primaryHealthMetric(component({ component: "ai_orchestrator", metrics: { avgConfidence: 0.82 } }))).toBe(0.82);
  });

  it("reads deliveryRate for notifications", () => {
    expect(primaryHealthMetric(component({ component: "notifications", metrics: { deliveryRate: 0.97 } }))).toBe(0.97);
  });

  it("inverts missRate into a hit rate for clinic knowledge", () => {
    expect(primaryHealthMetric(component({ component: "clinic_knowledge", metrics: { missRate: 0.1 } }))).toBeCloseTo(0.9);
  });

  it("returns null for an unrecognized component", () => {
    expect(primaryHealthMetric(component({ component: "something_else" }))).toBeNull();
  });
});

describe("computeHealthScore", () => {
  it("returns 100 for no components", () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it("scores healthy components within the healthy band, weighted by their primary metric", () => {
    const score = computeHealthScore([
      component({ component: "ai_orchestrator", metrics: { avgConfidence: 0.9 } }),
      component({ component: "notifications", metrics: { deliveryRate: 0.8 } }),
      component({ component: "clinic_knowledge", metrics: { missRate: 0.1 } }),
    ]);
    // healthy band is [0.85, 1]: 0.85+0.9*0.15=0.985, 0.85+0.8*0.15=0.97, 0.85+0.9*0.15=0.985 -> avg 0.98 -> 98
    expect(score).toBe(98);
  });

  it("never contradicts a 'healthy' status even when its primary metric is 0 from insufficient sample size", () => {
    // Mirrors lib/observability/health/thresholds.ts's MIN_SAMPLE_SIZE guard: a rate of 0 with no
    // samples yet is classified "healthy" (inconclusive), not "unhealthy" -- the score must agree.
    const score = computeHealthScore([
      component({ component: "ai_orchestrator", status: "healthy", metrics: { avgConfidence: 0 } }),
      component({ component: "notifications", status: "healthy", metrics: { deliveryRate: 0 } }),
    ]);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("falls back to the middle of the status band when a component has no primary metric", () => {
    const score = computeHealthScore([component({ component: "unknown_component", status: "degraded", metrics: {} })]);
    // degraded band midpoint: (0.5 + 0.85) / 2 = 0.675 -> 68
    expect(score).toBe(68);
  });

  it("scores an unhealthy component within the unhealthy band, below any healthy or degraded component", () => {
    const score = computeHealthScore([component({ component: "notifications", status: "unhealthy", metrics: { deliveryRate: 0.1 } })]);
    expect(score).toBeLessThan(50);
  });
});
