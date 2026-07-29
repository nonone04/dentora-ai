import { describe, expect, it } from "vitest";
import { computeReliabilityScore, type AppointmentOutcome } from "@/lib/ai/patient/reliability";

function repeat(outcome: AppointmentOutcome, times: number): AppointmentOutcome[] {
  return Array.from({ length: times }, () => outcome);
}

describe("computeReliabilityScore: empty history", () => {
  it("returns a zero score and insufficient_data label for no appointments at all", () => {
    const result = computeReliabilityScore([]);
    expect(result).toEqual({
      score: 0,
      label: "insufficient_data",
      completedCount: 0,
      noShowCount: 0,
      cancelledCount: 0,
      sampleSize: 0,
    });
  });
});

describe("computeReliabilityScore: sample size gating", () => {
  it("labels insufficient_data below the minimum sample size even with a perfect record", () => {
    const result = computeReliabilityScore(repeat("completed", 2));
    expect(result.score).toBe(1);
    expect(result.label).toBe("insufficient_data");
  });

  it("labels normally once the minimum sample size is reached", () => {
    const result = computeReliabilityScore(repeat("completed", 3));
    expect(result.label).toBe("excellent");
  });
});

describe("computeReliabilityScore: scoring formula", () => {
  it("scores a perfect completion record as 1.0", () => {
    const result = computeReliabilityScore(repeat("completed", 5));
    expect(result.score).toBe(1);
  });

  it("scores an all-no-show record as 0", () => {
    const result = computeReliabilityScore(repeat("no_show", 5));
    expect(result.score).toBe(0);
  });

  it("gives cancellations half credit -- better than no-show, worse than completing", () => {
    const allCancelled = computeReliabilityScore(repeat("cancelled", 4));
    expect(allCancelled.score).toBe(0.5);
  });

  it("weighs a mixed history correctly", () => {
    // 2 completed (full credit) + 1 cancelled (half credit) + 1 no-show (no credit) over 4 total.
    const result = computeReliabilityScore(["completed", "completed", "cancelled", "no_show"]);
    expect(result.score).toBeCloseTo(2.5 / 4, 5);
    expect(result.completedCount).toBe(2);
    expect(result.cancelledCount).toBe(1);
    expect(result.noShowCount).toBe(1);
    expect(result.sampleSize).toBe(4);
  });

  it("stays within [0, 1]", () => {
    const result = computeReliabilityScore(repeat("completed", 10));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe("computeReliabilityScore: label thresholds", () => {
  it("labels excellent at or above 0.85", () => {
    // 9 completed / 10 = 0.9
    const result = computeReliabilityScore([...repeat("completed", 9), "no_show"]);
    expect(result.label).toBe("excellent");
  });

  it("labels good between 0.65 and 0.85", () => {
    // 7 completed / 10 = 0.7
    const result = computeReliabilityScore([...repeat("completed", 7), ...repeat("no_show", 3)]);
    expect(result.label).toBe("good");
  });

  it("labels fair between 0.4 and 0.65", () => {
    // 5 completed / 10 = 0.5
    const result = computeReliabilityScore([...repeat("completed", 5), ...repeat("no_show", 5)]);
    expect(result.label).toBe("fair");
  });

  it("labels poor below 0.4", () => {
    // 2 completed / 10 = 0.2
    const result = computeReliabilityScore([...repeat("completed", 2), ...repeat("no_show", 8)]);
    expect(result.label).toBe("poor");
  });
});
