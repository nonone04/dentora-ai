import { describe, expect, it } from "vitest";
import { computeBackoffMinutes, computeNextAttemptAt, DEFAULT_MAX_ATTEMPTS, shouldRetry } from "@/lib/notifications/retry";

describe("computeBackoffMinutes", () => {
  it("doubles the delay with each attempt", () => {
    expect(computeBackoffMinutes(1)).toBe(5);
    expect(computeBackoffMinutes(2)).toBe(10);
    expect(computeBackoffMinutes(3)).toBe(20);
    expect(computeBackoffMinutes(4)).toBe(40);
  });

  it("caps the delay at 24 hours", () => {
    expect(computeBackoffMinutes(20)).toBe(24 * 60);
  });

  it("treats attempt 0 or negative the same as attempt 1", () => {
    expect(computeBackoffMinutes(0)).toBe(5);
    expect(computeBackoffMinutes(-3)).toBe(5);
  });
});

describe("computeNextAttemptAt", () => {
  it("adds the backoff delay to the given time", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const next = computeNextAttemptAt(2, now);
    expect(next.toISOString()).toBe("2026-08-01T00:10:00.000Z");
  });
});

describe("shouldRetry", () => {
  it("allows another attempt while under the max", () => {
    expect(shouldRetry(1, DEFAULT_MAX_ATTEMPTS)).toBe(true);
    expect(shouldRetry(4, DEFAULT_MAX_ATTEMPTS)).toBe(true);
  });

  it("refuses once attempts reach the max", () => {
    expect(shouldRetry(5, DEFAULT_MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetry(6, DEFAULT_MAX_ATTEMPTS)).toBe(false);
  });
});
