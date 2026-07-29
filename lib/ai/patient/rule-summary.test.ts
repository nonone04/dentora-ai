import { describe, expect, it } from "vitest";
import { buildRuleBasedSummary, type SummaryInputs } from "@/lib/ai/patient/rule-summary";

function makeInputs(overrides: Partial<SummaryInputs> = {}): SummaryInputs {
  return {
    patientName: "Sara Idrissi",
    reliability: { score: 0, label: "insufficient_data", completedCount: 0, noShowCount: 0, cancelledCount: 0, sampleSize: 0 },
    communication: { preferredChannel: null, sampleSize: 0 },
    scheduling: { preferredTimeOfDay: null, preferredDentistId: null, sampleSize: 0 },
    ...overrides,
  };
}

describe("buildRuleBasedSummary", () => {
  it("states plainly when there's no appointment history yet", () => {
    const summary = buildRuleBasedSummary(makeInputs());
    expect(summary).toBe("Sara Idrissi has no appointment history yet.");
  });

  it("summarizes appointment counts and reliability label", () => {
    const summary = buildRuleBasedSummary(
      makeInputs({
        reliability: { score: 0.8, label: "good", completedCount: 4, noShowCount: 1, cancelledCount: 0, sampleSize: 5 },
      }),
    );
    expect(summary).toContain("5 past appointments");
    expect(summary).toContain("4 completed, 1 no-show, 0 cancelled");
    expect(summary).toContain("reliability: good");
  });

  it("uses singular 'appointment' for exactly one", () => {
    const summary = buildRuleBasedSummary(
      makeInputs({
        reliability: { score: 1, label: "insufficient_data", completedCount: 1, noShowCount: 0, cancelledCount: 0, sampleSize: 1 },
      }),
    );
    expect(summary).toContain("1 past appointment ");
    expect(summary).not.toContain("1 past appointments");
  });

  it("renders the insufficient_data label with a space, not an underscore", () => {
    const summary = buildRuleBasedSummary(
      makeInputs({
        reliability: { score: 1, label: "insufficient_data", completedCount: 1, noShowCount: 0, cancelledCount: 0, sampleSize: 1 },
      }),
    );
    expect(summary).toContain("reliability: insufficient data");
  });

  it("mentions the preferred contact channel when known", () => {
    const summary = buildRuleBasedSummary(makeInputs({ communication: { preferredChannel: "whatsapp", sampleSize: 3 } }));
    expect(summary).toContain("Prefers contact via whatsapp.");
  });

  it("omits the contact channel sentence when unknown", () => {
    const summary = buildRuleBasedSummary(makeInputs());
    expect(summary).not.toContain("Prefers contact via");
  });

  it("mentions scheduling preferences when known", () => {
    const summary = buildRuleBasedSummary(
      makeInputs({ scheduling: { preferredTimeOfDay: "morning", preferredDentistId: "dentist-1", sampleSize: 4 } }),
    );
    expect(summary).toContain("Tends to prefer morning appointments and usually sees the same dentist.");
  });

  it("mentions only the time-of-day when there's no established dentist preference", () => {
    const summary = buildRuleBasedSummary(
      makeInputs({ scheduling: { preferredTimeOfDay: "evening", preferredDentistId: null, sampleSize: 2 } }),
    );
    expect(summary).toContain("Tends to prefer evening appointments.");
    expect(summary).not.toContain("usually sees the same dentist");
  });

  it("never invents a fact that wasn't in the inputs", () => {
    const summary = buildRuleBasedSummary(makeInputs());
    expect(summary).not.toMatch(/dentist|channel|morning|afternoon|evening/i);
  });
});
