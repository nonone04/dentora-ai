import { describe, expect, it } from "vitest";
import {
  generateCandidateSlots,
  isFullDayTimeOff,
  minutesToDateUTC,
  rangesOverlap,
  timeToMinutes,
} from "@/lib/ai/availability/hours";

const NOW = new Date("2026-07-20T00:00:00Z"); // well before the test dates below, so "already passed" never triggers unless a test wants it to
const DATE = "2026-08-05";

describe("timeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(timeToMinutes("09:30")).toBe(570);
  });

  it("parses HH:MM:SS (Postgres time serialization)", () => {
    expect(timeToMinutes("14:00:00")).toBe(840);
  });

  it("parses midnight and end-of-day", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("minutesToDateUTC", () => {
  it("anchors to UTC midnight of the given date", () => {
    expect(minutesToDateUTC(DATE, 0).toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("adds the offset in minutes", () => {
    expect(minutesToDateUTC(DATE, 570).toISOString()).toBe("2026-08-05T09:30:00.000Z");
  });

  it("rolls over into the next day past 24h of minutes", () => {
    expect(minutesToDateUTC(DATE, 1500).toISOString()).toBe("2026-08-06T01:00:00.000Z");
  });
});

describe("rangesOverlap", () => {
  const d = (h: number, m = 0) => minutesToDateUTC(DATE, h * 60 + m);

  it("detects a partial overlap", () => {
    expect(rangesOverlap(d(9), d(10), d(9, 30), d(11))).toBe(true);
  });

  it("detects full containment", () => {
    expect(rangesOverlap(d(9), d(12), d(10), d(11))).toBe(true);
  });

  it("detects identical ranges", () => {
    expect(rangesOverlap(d(9), d(10), d(9), d(10))).toBe(true);
  });

  it("does not flag back-to-back adjacent ranges as overlapping", () => {
    expect(rangesOverlap(d(9), d(10), d(10), d(11))).toBe(false);
  });

  it("does not flag disjoint ranges", () => {
    expect(rangesOverlap(d(9), d(10), d(14), d(15))).toBe(false);
  });
});

describe("generateCandidateSlots: business hours", () => {
  it("produces slots across the full working-hours block at the given duration", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      busyBlocks: [],
      now: NOW,
    });

    expect(slots.map((s) => s.startAt.toISOString())).toEqual(["2026-08-05T09:00:00.000Z", "2026-08-05T09:30:00.000Z"]);
  });

  it("does not produce a slot that would run past the end of the working-hours block", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 45,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      busyBlocks: [],
      now: NOW,
    });

    // Only one 45-minute slot fits in a 60-minute window; a second would run to 10:30, past the 10:00 close.
    expect(slots).toHaveLength(1);
    expect(slots[0].startAt.toISOString()).toBe("2026-08-05T09:00:00.000Z");
  });

  it("combines multiple working-hours blocks in the same day (e.g. a lunch break split)", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 60,
      workingHours: [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "17:00" },
      ],
      busyBlocks: [],
      now: NOW,
    });

    expect(slots).toHaveLength(6);
    expect(slots[2].startAt.toISOString()).toBe("2026-08-05T11:00:00.000Z");
    expect(slots[3].startAt.toISOString()).toBe("2026-08-05T14:00:00.000Z");
  });

  it("returns nothing when there are no working-hours blocks at all (day off)", () => {
    const slots = generateCandidateSlots({ date: DATE, durationMinutes: 30, workingHours: [], busyBlocks: [], now: NOW });
    expect(slots).toEqual([]);
  });
});

describe("generateCandidateSlots: conflicts (time off + existing appointments)", () => {
  it("excludes a slot that overlaps a busy block", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      busyBlocks: [{ start: minutesToDateUTC(DATE, 9 * 60), end: minutesToDateUTC(DATE, 9 * 60 + 30) }],
      now: NOW,
    });

    expect(slots.map((s) => s.startAt.toISOString())).toEqual(["2026-08-05T09:30:00.000Z"]);
  });

  it("fully books the day out when a busy block spans the whole working-hours window", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      busyBlocks: [{ start: minutesToDateUTC(DATE, 0), end: minutesToDateUTC(DATE, 24 * 60) }],
      now: NOW,
    });

    expect(slots).toEqual([]);
  });

  it("handles multiple existing appointments fragmenting the day", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "12:00" }],
      busyBlocks: [
        { start: minutesToDateUTC(DATE, 9 * 60), end: minutesToDateUTC(DATE, 9 * 60 + 30) },
        { start: minutesToDateUTC(DATE, 10 * 60), end: minutesToDateUTC(DATE, 10 * 60 + 30) },
        { start: minutesToDateUTC(DATE, 11 * 60 + 30), end: minutesToDateUTC(DATE, 12 * 60) },
      ],
      now: NOW,
    });

    expect(slots.map((s) => s.startAt.toISOString())).toEqual([
      "2026-08-05T09:30:00.000Z",
      "2026-08-05T10:30:00.000Z",
      "2026-08-05T11:00:00.000Z",
    ]);
  });

  it("excludes a slot that only partially overlaps a busy block, not just exact matches", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      // Appointment from 09:15-09:45 straddles both the 09:00 and 09:30 candidate slots.
      busyBlocks: [{ start: minutesToDateUTC(DATE, 9 * 60 + 15), end: minutesToDateUTC(DATE, 9 * 60 + 45) }],
      now: NOW,
    });

    expect(slots).toEqual([]);
  });
});

describe("generateCandidateSlots: edge cases", () => {
  it("filters out slots that have already passed", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 30,
      workingHours: [{ startTime: "09:00", endTime: "10:00" }],
      busyBlocks: [],
      now: minutesToDateUTC(DATE, 9 * 60 + 15), // "now" is mid-morning on the requested day
    });

    expect(slots.map((s) => s.startAt.toISOString())).toEqual(["2026-08-05T09:30:00.000Z"]);
  });

  it("caps the number of slots returned per the maxSlots option", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 15,
      workingHours: [{ startTime: "09:00", endTime: "17:00" }],
      busyBlocks: [],
      now: NOW,
      maxSlots: 3,
    });

    expect(slots).toHaveLength(3);
  });

  it("defaults to a cap of 20 slots", () => {
    const slots = generateCandidateSlots({
      date: DATE,
      durationMinutes: 15,
      workingHours: [{ startTime: "09:00", endTime: "17:00" }],
      busyBlocks: [],
      now: NOW,
    });

    expect(slots.length).toBeLessThanOrEqual(20);
  });
});

describe("isFullDayTimeOff", () => {
  const workingHours = [{ startTime: "09:00", endTime: "17:00" }];

  it("is true when a single time-off entry spans the whole working day", () => {
    const timeOff = [{ start: minutesToDateUTC(DATE, 0), end: minutesToDateUTC(DATE, 24 * 60) }];
    expect(isFullDayTimeOff(workingHours, timeOff, DATE)).toBe(true);
  });

  it("is true when time off exactly matches the working-hours span", () => {
    const timeOff = [{ start: minutesToDateUTC(DATE, 9 * 60), end: minutesToDateUTC(DATE, 17 * 60) }];
    expect(isFullDayTimeOff(workingHours, timeOff, DATE)).toBe(true);
  });

  it("is false when time off only covers part of the day", () => {
    const timeOff = [{ start: minutesToDateUTC(DATE, 9 * 60), end: minutesToDateUTC(DATE, 12 * 60) }];
    expect(isFullDayTimeOff(workingHours, timeOff, DATE)).toBe(false);
  });

  it("is false when there is no time off at all", () => {
    expect(isFullDayTimeOff(workingHours, [], DATE)).toBe(false);
  });

  it("is false when there are no working hours to compare against", () => {
    const timeOff = [{ start: minutesToDateUTC(DATE, 0), end: minutesToDateUTC(DATE, 24 * 60) }];
    expect(isFullDayTimeOff([], timeOff, DATE)).toBe(false);
  });
});
