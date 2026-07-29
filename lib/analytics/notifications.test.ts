import { describe, expect, it } from "vitest";
import { computeNotificationMetrics } from "@/lib/analytics/notifications";

describe("computeNotificationMetrics", () => {
  it("returns all-zero metrics for empty input", () => {
    const metrics = computeNotificationMetrics([]);
    expect(metrics.total).toBe(0);
    expect(metrics.deliveryRate).toBe(0);
    expect(metrics.failureRate).toBe(0);
    expect(metrics.avgAttempts).toBe(0);
  });

  it("treats sent/delivered/read as successfully delivered, pending/sending/failed as not", () => {
    const metrics = computeNotificationMetrics([
      { status: "sent", channel: "email", attempts: 1 },
      { status: "delivered", channel: "whatsapp", attempts: 1 },
      { status: "read", channel: "email", attempts: 1 },
      { status: "pending", channel: "sms", attempts: 0 },
      { status: "sending", channel: "email", attempts: 1 },
      { status: "failed", channel: "whatsapp", attempts: 5 },
    ]);

    expect(metrics.total).toBe(6);
    expect(metrics.deliveryRate).toBe(0.5); // 3 of 6
    expect(metrics.failureRate).toBeCloseTo(1 / 6);
  });

  it("counts by channel", () => {
    const metrics = computeNotificationMetrics([
      { status: "sent", channel: "email", attempts: 1 },
      { status: "sent", channel: "email", attempts: 1 },
      { status: "sent", channel: "in_app", attempts: 1 },
    ]);
    expect(metrics.byChannel).toMatchObject({ email: 2, in_app: 1, sms: 0, whatsapp: 0 });
  });

  it("computes average attempts across all deliveries", () => {
    const metrics = computeNotificationMetrics([
      { status: "sent", channel: "email", attempts: 1 },
      { status: "failed", channel: "email", attempts: 5 },
    ]);
    expect(metrics.avgAttempts).toBe(3);
  });
});
