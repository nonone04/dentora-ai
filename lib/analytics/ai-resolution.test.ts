import { describe, expect, it } from "vitest";
import { computeAIResolutionMetrics } from "@/lib/analytics/ai-resolution";

describe("computeAIResolutionMetrics", () => {
  it("returns all-zero metrics for empty input", () => {
    const metrics = computeAIResolutionMetrics({ turnEvents: [], decisions: [] });
    expect(metrics.totalTurns).toBe(0);
    expect(metrics.totalDecisions).toBe(0);
    expect(metrics.autoResolvedRate).toBe(0);
    expect(metrics.escalationRate).toBe(0);
    expect(metrics.errorRate).toBe(0);
    expect(metrics.avgConfidence).toBe(0);
    expect(metrics.avgLatencyMs).toBe(0);
  });

  it("classifies auto-resolved vs escalated decision kinds correctly", () => {
    const metrics = computeAIResolutionMetrics({
      turnEvents: [],
      decisions: [
        { decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 },
        { decision_kind: "reply_directly", intent: "greeting", confidence: 0.8 },
        { decision_kind: "ask_follow_up", intent: "book_appointment", confidence: 0.6 },
        { decision_kind: "escalate_to_staff", intent: "other", confidence: 0.3 },
        { decision_kind: "emergency_workflow", intent: "other", confidence: 0.95 },
      ],
    });

    expect(metrics.totalDecisions).toBe(5);
    // 3 auto-resolved out of 5
    expect(metrics.autoResolvedRate).toBeCloseTo(0.6);
    // 2 escalated out of 5
    expect(metrics.escalationRate).toBeCloseTo(0.4);
  });

  it("classifies llm_error and tool_calls_exhausted as errors, reply/escalated as not", () => {
    const metrics = computeAIResolutionMetrics({
      turnEvents: [
        { outcome: "reply", latency_ms: 100 },
        { outcome: "llm_error", latency_ms: 200 },
        { outcome: "tool_calls_exhausted", latency_ms: 300 },
        { outcome: "escalated", latency_ms: 400 },
      ],
      decisions: [],
    });

    expect(metrics.totalTurns).toBe(4);
    expect(metrics.errorRate).toBe(0.5); // 2 of 4
    expect(metrics.avgLatencyMs).toBe(250);
  });

  it("computes average confidence across decisions", () => {
    const metrics = computeAIResolutionMetrics({
      turnEvents: [],
      decisions: [
        { decision_kind: "execute_tool", intent: "book_appointment", confidence: 1 },
        { decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.5 },
      ],
    });
    expect(metrics.avgConfidence).toBe(0.75);
  });

  it("counts intents and decision kinds independently, ignoring unrecognized values", () => {
    const metrics = computeAIResolutionMetrics({
      turnEvents: [],
      decisions: [
        { decision_kind: "execute_tool", intent: "book_appointment", confidence: 0.9 },
        { decision_kind: "unknown_kind", intent: "unknown_intent", confidence: 0.1 },
      ],
    });
    expect(metrics.byDecisionKind.execute_tool).toBe(1);
    expect(metrics.byIntent.book_appointment).toBe(1);
    expect(metrics.totalDecisions).toBe(2); // still counted in the total even if unclassifiable
  });
});
