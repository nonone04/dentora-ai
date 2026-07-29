import { describe, expect, it } from "vitest";
import { describeActivityEvent } from "@/lib/ai/patient/timeline";
import { PATIENT_ACTIVITY_EVENT_TYPES } from "@/lib/ai/patient/types";

describe("describeActivityEvent", () => {
  it("returns a non-empty, human-readable description for every activity type", () => {
    for (const type of PATIENT_ACTIVITY_EVENT_TYPES) {
      const description = describeActivityEvent(type);
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it("returns a distinct description per type (no accidental duplicates)", () => {
    const descriptions = PATIENT_ACTIVITY_EVENT_TYPES.map(describeActivityEvent);
    expect(new Set(descriptions).size).toBe(PATIENT_ACTIVITY_EVENT_TYPES.length);
  });
});
