import { describe, expect, it } from "vitest";
import { buildAvailabilitySection } from "@/lib/ai/availability/prompt";
import type { AvailabilityResult } from "@/lib/ai/availability/types";

function makeResult(overrides: Partial<AvailabilityResult> = {}): AvailabilityResult {
  return {
    query: { clinicId: "clinic-1", date: "2026-08-05", serviceId: null, dentistId: null, preferredTime: null },
    durationMinutes: 30,
    options: [],
    conflicts: [],
    fallbacks: [],
    fallbackDate: null,
    ...overrides,
  };
}

describe("buildAvailabilitySection", () => {
  it("returns null when there is no result (the engine didn't run this turn)", () => {
    expect(buildAvailabilitySection(null)).toBeNull();
  });

  it("lists ranked options for the requested date", () => {
    const section = buildAvailabilitySection(
      makeResult({
        options: [
          { dentistId: "d1", dentistName: "Dr. Amrani", startAt: "2026-08-05T09:00:00.000Z", endAt: "2026-08-05T09:30:00.000Z", score: 0.9 },
        ],
      }),
    );

    expect(section).toContain("# Real-time availability");
    expect(section).toContain("2026-08-05T09:00:00.000Z");
    expect(section).toContain("Dr. Amrani");
    expect(section).toContain("never invent or guess a time");
  });

  it("caps the listed options to keep the prompt concise", () => {
    const options = Array.from({ length: 10 }, (_, i) => ({
      dentistId: "d1",
      dentistName: "Dr. Amrani",
      startAt: `2026-08-05T${String(9 + i).padStart(2, "0")}:00:00.000Z`,
      endAt: `2026-08-05T${String(9 + i).padStart(2, "0")}:30:00.000Z`,
      score: 1 - i * 0.01,
    }));

    const section = buildAvailabilitySection(makeResult({ options }));
    const listedLines = section?.split("\n").filter((line) => line.trim().startsWith("-")) ?? [];
    expect(listedLines.length).toBeLessThanOrEqual(5);
  });

  it("falls back to the nearest alternative day when the requested date has none", () => {
    const section = buildAvailabilitySection(
      makeResult({
        fallbacks: [
          { dentistId: "d1", dentistName: "Dr. Amrani", startAt: "2026-08-06T09:00:00.000Z", endAt: "2026-08-06T09:30:00.000Z", score: 0.8 },
        ],
        fallbackDate: "2026-08-06",
      }),
    );

    expect(section).toContain("No availability on 2026-08-05");
    expect(section).toContain("2026-08-06");
    expect(section).toContain("Dr. Amrani");
  });

  it("says plainly there's nothing available when even the fallback search found nothing", () => {
    const section = buildAvailabilitySection(makeResult());
    expect(section).toContain("No availability found");
  });

  it("includes conflict explanations as notes", () => {
    const section = buildAvailabilitySection(
      makeResult({ conflicts: [{ type: "fully_booked", message: "Dr. Amrani is fully booked on the requested day.", dentistId: "d1" }] }),
    );

    expect(section).toContain("Notes:");
    expect(section).toContain("Dr. Amrani is fully booked");
  });
});
