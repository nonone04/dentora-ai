import { describe, expect, it } from "vitest";
import { computeAppointmentMetrics } from "@/lib/analytics/appointments";

describe("computeAppointmentMetrics", () => {
  it("returns all-zero metrics for an empty input", () => {
    const metrics = computeAppointmentMetrics([]);
    expect(metrics.total).toBe(0);
    expect(metrics.aiBookedRate).toBe(0);
    expect(metrics.noShowRate).toBe(0);
    expect(metrics.cancellationRate).toBe(0);
    expect(metrics.completionRate).toBe(0);
    expect(metrics.byStatus).toEqual({ scheduled: 0, confirmed: 0, cancelled: 0, completed: 0, no_show: 0 });
  });

  it("counts by status and source", () => {
    const metrics = computeAppointmentMetrics([
      { status: "completed", source: "ai_assistant" },
      { status: "completed", source: "staff" },
      { status: "cancelled", source: "ai_assistant" },
      { status: "no_show", source: "staff" },
      { status: "scheduled", source: "staff" },
    ]);

    expect(metrics.total).toBe(5);
    expect(metrics.byStatus).toMatchObject({ completed: 2, cancelled: 1, no_show: 1, scheduled: 1, confirmed: 0 });
    expect(metrics.bySource).toEqual({ ai_assistant: 2, staff: 3 });
  });

  it("computes aiBookedRate as a share of all appointments", () => {
    const metrics = computeAppointmentMetrics([
      { status: "scheduled", source: "ai_assistant" },
      { status: "scheduled", source: "ai_assistant" },
      { status: "scheduled", source: "staff" },
      { status: "scheduled", source: "staff" },
    ]);
    expect(metrics.aiBookedRate).toBe(0.5);
  });

  it("computes noShowRate/completionRate as a share of SETTLED appointments only, not all appointments", () => {
    const metrics = computeAppointmentMetrics([
      { status: "completed", source: "staff" },
      { status: "no_show", source: "staff" },
      { status: "scheduled", source: "staff" }, // not settled -- excluded from the denominator
      { status: "confirmed", source: "staff" }, // not settled -- excluded from the denominator
    ]);
    // settled = completed(1) + no_show(1) + cancelled(0) = 2
    expect(metrics.noShowRate).toBe(0.5);
    expect(metrics.completionRate).toBe(0.5);
  });

  it("computes cancellationRate as a share of ALL appointments, not just settled ones", () => {
    const metrics = computeAppointmentMetrics([
      { status: "cancelled", source: "staff" },
      { status: "scheduled", source: "staff" },
      { status: "scheduled", source: "staff" },
      { status: "scheduled", source: "staff" },
    ]);
    expect(metrics.cancellationRate).toBe(0.25);
  });

  it("ignores rows with an unrecognized status/source rather than throwing", () => {
    const metrics = computeAppointmentMetrics([{ status: "weird-status", source: "weird-source" }]);
    expect(metrics.total).toBe(1);
    expect(Object.values(metrics.byStatus).every((count) => count === 0)).toBe(true);
    expect(Object.values(metrics.bySource).every((count) => count === 0)).toBe(true);
  });
});
