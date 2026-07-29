import { describe, expect, it } from "vitest";
import { buildFollowUpQuestion } from "@/lib/ai/nlu/follow-up";

describe("buildFollowUpQuestion", () => {
  it("throws when there are no missing fields", () => {
    expect(() => buildFollowUpQuestion([])).toThrow();
  });

  it("asks about a single missing field in English by default", () => {
    const question = buildFollowUpQuestion(["date"]);
    expect(question).toContain("what date works for you");
    expect(question.endsWith("?")).toBe(true);
  });

  it("joins multiple missing fields with a natural 'and'", () => {
    const question = buildFollowUpQuestion(["date", "service"], { language: "en" });
    expect(question).toBe("Happy to help with that! Could you tell me what date works for you and what treatment this is for?");
  });

  it("joins three or more fields with commas and a trailing 'and'", () => {
    const question = buildFollowUpQuestion(["date", "service", "patientName"], { language: "en" });
    expect(question).toBe(
      "Happy to help with that! Could you tell me what date works for you, what treatment this is for and your full name?",
    );
  });

  it("responds in French when the detected language is French", () => {
    const question = buildFollowUpQuestion(["date"], { language: "fr" });
    expect(question).toBe("Avec plaisir ! Pouvez-vous me dire quelle date vous convient?");
  });

  it("responds in Arabic when the detected language is Arabic", () => {
    const question = buildFollowUpQuestion(["date"], { language: "ar" });
    expect(question).toContain("التاريخ الذي يناسبك");
  });

  it("falls back to the clinic's default language when the detected language is 'other'", () => {
    const question = buildFollowUpQuestion(["date"], { language: "other", clinicDefaultLanguage: "fr" });
    expect(question).toBe("Avec plaisir ! Pouvez-vous me dire quelle date vous convient?");
  });

  it("falls back to English when neither the detected nor the clinic's default language is recognized", () => {
    const question = buildFollowUpQuestion(["date"], { language: "other", clinicDefaultLanguage: undefined });
    expect(question).toContain("what date works for you");
  });
});
