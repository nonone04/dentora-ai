import { describe, expect, it } from "vitest";
import { reconstructTraceSteps, type TraceRawData } from "@/lib/observability/trace/reconstruct";

const EMPTY: TraceRawData = {
  messages: [],
  nluExtractions: [],
  decisions: [],
  availabilityQueries: [],
  knowledgeSearches: [],
  lifecycleEvents: [],
  notificationEvents: [],
  turnEvents: [],
};

describe("reconstructTraceSteps", () => {
  it("returns an empty array for no data", () => {
    expect(reconstructTraceSteps(EMPTY)).toEqual([]);
  });

  it("orders every step chronologically across all sources", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      messages: [{ role: "user", content: "Hi", ai_action: null, created_at: "2026-07-27T10:00:00.000Z" }],
      decisions: [
        { decision_kind: "reply_directly", reason: "greeting", intent: "greeting", urgency: "low", confidence: 0.9, latency_ms: 50, created_at: "2026-07-27T10:00:02.000Z" },
      ],
      nluExtractions: [
        { intent: "greeting", urgency: "low", language: "en", confidence: 0.9, missing_fields: [], latency_ms: 40, created_at: "2026-07-27T10:00:01.000Z" },
      ],
    };

    const steps = reconstructTraceSteps(raw);
    expect(steps.map((s) => s.type)).toEqual(["message", "nlu_extraction", "decision"]);
  });

  it("classifies an assistant message with ai_action as a tool_call step, not a plain message", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      messages: [
        { role: "assistant", content: "Booking...", ai_action: "draft_appointment", created_at: "2026-07-27T10:00:00.000Z" },
        { role: "assistant", content: "All set!", ai_action: null, created_at: "2026-07-27T10:00:01.000Z" },
      ],
    };

    const steps = reconstructTraceSteps(raw);
    expect(steps[0]).toMatchObject({ type: "tool_call", summary: expect.stringContaining("draft_appointment") });
    expect(steps[1]).toMatchObject({ type: "message" });
  });

  it("truncates a long message body in the summary but keeps the full content in data", () => {
    const longContent = "x".repeat(200);
    const raw: TraceRawData = { ...EMPTY, messages: [{ role: "user", content: longContent, ai_action: null, created_at: "2026-07-27T10:00:00.000Z" }] };
    const steps = reconstructTraceSteps(raw);
    expect(steps[0].summary.length).toBeLessThan(longContent.length);
    expect(steps[0].data.content).toBe(longContent);
  });

  it("summarizes an availability query with option and fallback counts", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      availabilityQueries: [{ requested_date: "2026-08-01", options_count: 3, fallback_count: 2, latency_ms: 80, created_at: "2026-07-27T10:00:00.000Z" }],
    };
    const [step] = reconstructTraceSteps(raw);
    expect(step.summary).toContain("2026-08-01");
    expect(step.summary).toContain("3 option");
    expect(step.summary).toContain("2 fallback");
  });

  it("summarizes a knowledge search hit vs miss", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      knowledgeSearches: [
        { query: "opening hours", hit: true, matched_record_ids: ["r1"], latency_ms: 10, created_at: "2026-07-27T10:00:00.000Z" },
        { query: "braces", hit: false, matched_record_ids: [], latency_ms: 10, created_at: "2026-07-27T10:00:01.000Z" },
      ],
    };
    const steps = reconstructTraceSteps(raw);
    expect(steps[0].summary).toContain("found a match");
    expect(steps[1].summary).toContain("no match");
  });

  it("summarizes a lifecycle event's status transition", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      lifecycleEvents: [
        { entity_type: "appointment", event: "cancel", from_status: "confirmed", to_status: "cancelled", actor: "ai_assistant", created_at: "2026-07-27T10:00:00.000Z" },
      ],
    };
    const [step] = reconstructTraceSteps(raw);
    expect(step.summary).toContain("confirmed");
    expect(step.summary).toContain("cancelled");
    expect(step.summary).toContain("ai_assistant");
  });

  it("summarizes a turn event's outcome and iteration count", () => {
    const raw: TraceRawData = { ...EMPTY, turnEvents: [{ outcome: "reply", iteration_count: 2, latency_ms: 900, model: "claude", created_at: "2026-07-27T10:00:00.000Z" }] };
    const [step] = reconstructTraceSteps(raw);
    expect(step.summary).toContain("reply");
    expect(step.summary).toContain("2 iteration");
    expect(step.summary).toContain("900ms");
  });

  it("preserves the full raw row in data for every step type", () => {
    const raw: TraceRawData = {
      ...EMPTY,
      notificationEvents: [{ type: "appointment_confirmed", created_at: "2026-07-27T10:00:00.000Z" }],
    };
    const [step] = reconstructTraceSteps(raw);
    expect(step.data).toEqual({ type: "appointment_confirmed", created_at: "2026-07-27T10:00:00.000Z" });
  });
});
