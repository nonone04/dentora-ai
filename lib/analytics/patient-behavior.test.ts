import { describe, expect, it } from "vitest";
import { computePatientBehaviorMetrics } from "@/lib/analytics/patient-behavior";

const RANGE_FROM = "2026-07-01T00:00:00.000Z";

describe("computePatientBehaviorMetrics", () => {
  it("returns all-zero metrics for empty input", () => {
    const metrics = computePatientBehaviorMetrics([], { rangeFrom: RANGE_FROM });
    expect(metrics.totalPatients).toBe(0);
    expect(metrics.newPatients).toBe(0);
    expect(metrics.returningPatients).toBe(0);
    expect(metrics.avgReliabilityScore).toBe(0);
  });

  it("counts by reliability label", () => {
    const metrics = computePatientBehaviorMetrics(
      [
        { reliability_label: "excellent", reliability_score: 0.95, preferred_channel: "email", created_at: "2026-06-01T00:00:00.000Z" },
        { reliability_label: "poor", reliability_score: 0.2, preferred_channel: "sms", created_at: "2026-06-01T00:00:00.000Z" },
      ],
      { rangeFrom: RANGE_FROM },
    );
    expect(metrics.byReliabilityLabel).toMatchObject({ excellent: 1, poor: 1, good: 0, fair: 0, insufficient_data: 0 });
  });

  it("counts by preferred channel, omitting patients with no preference learned yet", () => {
    const metrics = computePatientBehaviorMetrics(
      [
        { reliability_label: "good", reliability_score: 0.8, preferred_channel: "whatsapp", created_at: "2026-06-01T00:00:00.000Z" },
        { reliability_label: "insufficient_data", reliability_score: 0, preferred_channel: null, created_at: "2026-06-01T00:00:00.000Z" },
      ],
      { rangeFrom: RANGE_FROM },
    );
    expect(metrics.byPreferredChannel).toEqual({ whatsapp: 1 });
  });

  it("splits new (created within range) vs returning (created before range) patients", () => {
    const metrics = computePatientBehaviorMetrics(
      [
        { reliability_label: "good", reliability_score: 0.8, preferred_channel: "email", created_at: "2026-07-15T00:00:00.000Z" }, // new
        { reliability_label: "good", reliability_score: 0.8, preferred_channel: "email", created_at: "2026-05-01T00:00:00.000Z" }, // returning
      ],
      { rangeFrom: RANGE_FROM },
    );
    expect(metrics.newPatients).toBe(1);
    expect(metrics.returningPatients).toBe(1);
  });

  it("computes the average reliability score across all patients", () => {
    const metrics = computePatientBehaviorMetrics(
      [
        { reliability_label: "excellent", reliability_score: 1, preferred_channel: "email", created_at: "2026-06-01T00:00:00.000Z" },
        { reliability_label: "poor", reliability_score: 0, preferred_channel: "email", created_at: "2026-06-01T00:00:00.000Z" },
      ],
      { rangeFrom: RANGE_FROM },
    );
    expect(metrics.avgReliabilityScore).toBe(0.5);
  });
});
