import { describe, expect, it } from "vitest";
import {
  computeAIHealthCheck,
  computeKnowledgeHealthCheck,
  computeNotificationHealthCheck,
  computeOverallStatus,
  worstOf,
} from "@/lib/observability/health/checks";
import { MIN_SAMPLE_SIZE } from "@/lib/observability/health/thresholds";

function repeat<T>(value: T, count: number): T[] {
  return Array.from({ length: count }, () => value);
}

describe("worstOf", () => {
  it("returns healthy for no arguments", () => {
    expect(worstOf()).toBe("healthy");
  });

  it("returns the most severe status among the given ones, regardless of order", () => {
    expect(worstOf("healthy", "degraded")).toBe("degraded");
    expect(worstOf("unhealthy", "healthy", "degraded")).toBe("unhealthy");
    expect(worstOf("degraded", "degraded")).toBe("degraded");
  });
});

describe("computeAIHealthCheck", () => {
  it("reports healthy below the minimum sample size, even with a 100% error rate", () => {
    const check = computeAIHealthCheck({ turnEvents: repeat({ outcome: "llm_error", latency_ms: 100 }, MIN_SAMPLE_SIZE - 1), decisions: [] });
    expect(check.status).toBe("healthy");
  });

  it("reports degraded once the error rate crosses the degraded threshold with enough samples", () => {
    const turnEvents = [
      ...repeat({ outcome: "llm_error", latency_ms: 100 }, 2),
      ...repeat({ outcome: "reply", latency_ms: 100 }, 8),
    ]; // 20% error rate, 10 samples
    const check = computeAIHealthCheck({ turnEvents, decisions: [] });
    expect(check.status).toBe("degraded");
    expect(check.metrics.errorRate).toBeCloseTo(0.2);
  });

  it("reports unhealthy once the error rate crosses the unhealthy threshold", () => {
    const turnEvents = [...repeat({ outcome: "llm_error", latency_ms: 100 }, 5), ...repeat({ outcome: "reply", latency_ms: 100 }, 5)]; // 50%
    const check = computeAIHealthCheck({ turnEvents, decisions: [] });
    expect(check.status).toBe("unhealthy");
  });

  it("also considers the escalation rate from decisions, taking the worse of the two signals", () => {
    const decisions = [
      ...repeat({ decision_kind: "escalate_to_staff", intent: "other", confidence: 0.5 }, 7),
      ...repeat({ decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 }, 3),
    ]; // 70% escalation rate -- turn events are all healthy
    const check = computeAIHealthCheck({ turnEvents: repeat({ outcome: "reply", latency_ms: 50 }, 10), decisions });
    expect(check.status).toBe("unhealthy");
  });

  it("reports the component name and includes key metrics", () => {
    const check = computeAIHealthCheck({ turnEvents: [], decisions: [] });
    expect(check.component).toBe("ai_orchestrator");
    expect(check.metrics).toHaveProperty("errorRate");
    expect(check.metrics).toHaveProperty("escalationRate");
    expect(check.message).toEqual(expect.any(String));
  });
});

describe("computeNotificationHealthCheck", () => {
  it("reports healthy below the minimum sample size", () => {
    const check = computeNotificationHealthCheck(repeat({ status: "failed", channel: "email", attempts: 5 }, MIN_SAMPLE_SIZE - 1));
    expect(check.status).toBe("healthy");
  });

  it("reports unhealthy once the failure rate crosses the unhealthy threshold", () => {
    const deliveries = [...repeat({ status: "failed", channel: "email", attempts: 5 }, 4), ...repeat({ status: "sent", channel: "email", attempts: 1 }, 6)]; // 40%
    const check = computeNotificationHealthCheck(deliveries);
    expect(check.status).toBe("unhealthy");
  });

  it("reports healthy when nothing is failing", () => {
    const check = computeNotificationHealthCheck(repeat({ status: "sent", channel: "email", attempts: 1 }, 20));
    expect(check.status).toBe("healthy");
  });
});

describe("computeKnowledgeHealthCheck", () => {
  it("reports healthy below the minimum sample size", () => {
    const check = computeKnowledgeHealthCheck(repeat({ hit: false }, MIN_SAMPLE_SIZE - 1));
    expect(check.status).toBe("healthy");
  });

  it("reports degraded/unhealthy as the miss rate climbs", () => {
    const mostlyMisses = [...repeat({ hit: false }, 8), ...repeat({ hit: true }, 2)]; // 80% miss rate
    const check = computeKnowledgeHealthCheck(mostlyMisses);
    expect(check.status).toBe("unhealthy");
  });

  it("reports healthy when hit rate is high", () => {
    const mostlyHits = [...repeat({ hit: true }, 9), ...repeat({ hit: false }, 1)];
    const check = computeKnowledgeHealthCheck(mostlyHits);
    expect(check.status).toBe("healthy");
  });
});

describe("computeOverallStatus", () => {
  it("is the worst of every component", () => {
    const status = computeOverallStatus([
      { component: "a", status: "healthy", metrics: {}, message: "" },
      { component: "b", status: "unhealthy", metrics: {}, message: "" },
      { component: "c", status: "degraded", metrics: {}, message: "" },
    ]);
    expect(status).toBe("unhealthy");
  });

  it("is healthy when there are no components", () => {
    expect(computeOverallStatus([])).toBe("healthy");
  });
});
