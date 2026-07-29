import { describe, expect, it } from "vitest";
import { rankSlots, scoreSlot } from "@/lib/ai/availability/ranking";
import type { AvailabilitySlot } from "@/lib/ai/availability/types";

function slot(overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return { dentistId: "dentist-1", dentistName: "Dr. Amrani", startAt: "2026-08-05T09:00:00.000Z", endAt: "2026-08-05T09:30:00.000Z", score: 0, ...overrides };
}

describe("scoreSlot", () => {
  it("gives a baseline score with no preferences", () => {
    expect(scoreSlot(slot(), {})).toBeGreaterThan(0);
  });

  it("boosts a slot matching the preferred dentist", () => {
    const withPref = scoreSlot(slot({ dentistId: "dentist-1" }), { preferredDentistId: "dentist-1" });
    const withoutPref = scoreSlot(slot({ dentistId: "dentist-1" }), { preferredDentistId: "dentist-2" });
    expect(withPref).toBeGreaterThan(withoutPref);
  });

  it("boosts a slot matching an exact preferred time", () => {
    const exact = scoreSlot(slot({ startAt: "2026-08-05T09:00:00.000Z" }), { preferredTime: "09:00" });
    const off = scoreSlot(slot({ startAt: "2026-08-05T14:00:00.000Z" }), { preferredTime: "09:00" });
    expect(exact).toBeGreaterThan(off);
  });

  it("treats a time within tolerance as an exact match", () => {
    const close = scoreSlot(slot({ startAt: "2026-08-05T09:10:00.000Z" }), { preferredTime: "09:00" });
    const far = scoreSlot(slot({ startAt: "2026-08-05T11:00:00.000Z" }), { preferredTime: "09:00" });
    expect(close).toBeGreaterThan(far);
  });

  it("gives a partial boost for matching a vague time-of-day period", () => {
    const morningSlot = scoreSlot(slot({ startAt: "2026-08-05T09:00:00.000Z" }), { preferredTime: "morning" });
    const eveningSlot = scoreSlot(slot({ startAt: "2026-08-05T18:00:00.000Z" }), { preferredTime: "morning" });
    expect(morningSlot).toBeGreaterThan(eveningSlot);
  });

  it("ranks an exact time match higher than a vague period match", () => {
    const exact = scoreSlot(slot({ startAt: "2026-08-05T09:00:00.000Z" }), { preferredTime: "09:00" });
    const period = scoreSlot(slot({ startAt: "2026-08-05T09:00:00.000Z" }), { preferredTime: "morning" });
    expect(exact).toBeGreaterThan(period);
  });

  it("prefers an earlier slot as a tiebreaker when nothing else differs", () => {
    const earlier = scoreSlot(slot({ startAt: "2026-08-05T09:00:00.000Z" }), {});
    const later = scoreSlot(slot({ startAt: "2026-08-05T16:00:00.000Z" }), {});
    expect(earlier).toBeGreaterThan(later);
  });

  it("never lets the earliness tiebreaker outrank a real dentist preference", () => {
    const matchingButLate = scoreSlot(slot({ dentistId: "dentist-1", startAt: "2026-08-05T16:00:00.000Z" }), {
      preferredDentistId: "dentist-1",
    });
    const nonMatchingButEarly = scoreSlot(slot({ dentistId: "dentist-2", startAt: "2026-08-05T09:00:00.000Z" }), {
      preferredDentistId: "dentist-1",
    });
    expect(matchingButLate).toBeGreaterThan(nonMatchingButEarly);
  });

  it("stays within [0, 1]", () => {
    const score = scoreSlot(slot({ dentistId: "dentist-1", startAt: "2026-08-05T09:00:00.000Z" }), {
      preferredDentistId: "dentist-1",
      preferredTime: "09:00",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("rankSlots", () => {
  it("sorts best-match-first", () => {
    const slots = [
      slot({ dentistId: "dentist-2", startAt: "2026-08-05T09:00:00.000Z" }),
      slot({ dentistId: "dentist-1", startAt: "2026-08-05T15:00:00.000Z" }),
    ];

    const ranked = rankSlots(slots, { preferredDentistId: "dentist-1" });
    expect(ranked[0].dentistId).toBe("dentist-1");
  });

  it("breaks a tie by earliest start time", () => {
    const slots = [
      slot({ dentistId: "dentist-1", startAt: "2026-08-05T15:00:00.000Z" }),
      slot({ dentistId: "dentist-1", startAt: "2026-08-05T09:00:00.000Z" }),
    ];

    const ranked = rankSlots(slots, {});
    expect(ranked[0].startAt).toBe("2026-08-05T09:00:00.000Z");
    expect(ranked[1].startAt).toBe("2026-08-05T15:00:00.000Z");
  });

  it("returns an empty array unchanged", () => {
    expect(rankSlots([], {})).toEqual([]);
  });

  it("annotates every slot with its computed score", () => {
    const ranked = rankSlots([slot()], { preferredDentistId: "dentist-1" });
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});
