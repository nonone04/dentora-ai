import { describe, expect, it } from "vitest";
import { bucketAmountsByDay, bucketCountsByDay, computeTrend, trendFromBuckets } from "@/lib/dashboard/trends";

describe("computeTrend", () => {
  it("is flat when current equals previous", () => {
    expect(computeTrend(5, 5)).toEqual({ direction: "flat", diffCount: 0, diffPercent: 0 });
  });

  it("is up with a percent diff when current exceeds previous", () => {
    const trend = computeTrend(15, 10);
    expect(trend.direction).toBe("up");
    expect(trend.diffCount).toBe(5);
    expect(trend.diffPercent).toBeCloseTo(0.5);
  });

  it("is down when current is below previous", () => {
    const trend = computeTrend(4, 10);
    expect(trend.direction).toBe("down");
    expect(trend.diffCount).toBe(-6);
  });

  it("has a null percent diff when previous is zero, instead of dividing by zero", () => {
    const trend = computeTrend(3, 0);
    expect(trend.direction).toBe("up");
    expect(trend.diffPercent).toBeNull();
  });
});

describe("bucketCountsByDay", () => {
  const endExclusive = new Date("2026-07-15T09:00:00.000Z");

  it("places each date in the bucket for its UTC day, oldest first", () => {
    const buckets = bucketCountsByDay(["2026-07-14T23:59:00.000Z", "2026-07-14T00:01:00.000Z", "2026-07-13T12:00:00.000Z"], 3, endExclusive);
    // window covers UTC days 2026-07-12, 07-13, 07-14 (endExclusive's day, 07-15, is not included)
    expect(buckets).toEqual([0, 1, 2]);
  });

  it("drops dates outside the window", () => {
    const buckets = bucketCountsByDay(["2026-01-01T00:00:00.000Z"], 3, endExclusive);
    expect(buckets).toEqual([0, 0, 0]);
  });

  it("returns all-zero buckets for empty input", () => {
    expect(bucketCountsByDay([], 5, endExclusive)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("bucketAmountsByDay", () => {
  it("sums amounts per day instead of counting rows", () => {
    const endExclusive = new Date("2026-07-15T00:00:00.000Z");
    const buckets = bucketAmountsByDay(
      [
        { date: "2026-07-14T08:00:00.000Z", amount: 100 },
        { date: "2026-07-14T18:00:00.000Z", amount: 50 },
        { date: "2026-07-13T08:00:00.000Z", amount: 25 },
      ],
      3,
      endExclusive,
    );
    expect(buckets).toEqual([0, 25, 150]);
  });
});

describe("trendFromBuckets", () => {
  it("compares the trailing half of the array against the preceding half", () => {
    // 14 entries: first 7 sum to 7, last 7 sum to 21
    const buckets = [1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3];
    const trend = trendFromBuckets(buckets);
    expect(trend.direction).toBe("up");
    expect(trend.diffCount).toBe(14);
  });

  it("is flat for an all-zero series", () => {
    expect(trendFromBuckets(new Array(14).fill(0)).direction).toBe("flat");
  });
});
