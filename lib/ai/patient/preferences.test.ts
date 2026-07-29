import { describe, expect, it } from "vitest";
import { learnCommunicationPreferences, learnSchedulingPreferences } from "@/lib/ai/patient/preferences";

describe("learnCommunicationPreferences", () => {
  it("returns null with no history", () => {
    expect(learnCommunicationPreferences([])).toEqual({ preferredChannel: null, sampleSize: 0 });
  });

  it("picks the plurality channel", () => {
    const result = learnCommunicationPreferences(["whatsapp", "whatsapp", "sms"]);
    expect(result).toEqual({ preferredChannel: "whatsapp", sampleSize: 3 });
  });

  it("excludes web_chat -- it isn't a real notification channel a reminder could be sent on", () => {
    const result = learnCommunicationPreferences(["web_chat", "web_chat", "web_chat", "sms"]);
    expect(result).toEqual({ preferredChannel: "sms", sampleSize: 1 });
  });

  it("returns null when every conversation was on web_chat", () => {
    const result = learnCommunicationPreferences(["web_chat", "web_chat"]);
    expect(result).toEqual({ preferredChannel: null, sampleSize: 0 });
  });

  it("ignores an unrecognized channel value rather than crashing", () => {
    const result = learnCommunicationPreferences(["sms", "carrier_pigeon"]);
    expect(result).toEqual({ preferredChannel: "sms", sampleSize: 1 });
  });
});

describe("learnSchedulingPreferences", () => {
  it("returns nulls with no completed appointments", () => {
    expect(learnSchedulingPreferences([])).toEqual({ preferredTimeOfDay: null, preferredDentistId: null, sampleSize: 0 });
  });

  it("classifies morning (before 12:00 UTC)", () => {
    const result = learnSchedulingPreferences([{ dentistId: "d1", startAt: "2026-08-05T09:00:00Z" }]);
    expect(result.preferredTimeOfDay).toBe("morning");
  });

  it("classifies the 12:00 boundary as afternoon, not morning", () => {
    const result = learnSchedulingPreferences([{ dentistId: "d1", startAt: "2026-08-05T12:00:00Z" }]);
    expect(result.preferredTimeOfDay).toBe("afternoon");
  });

  it("classifies afternoon (12:00-17:00 UTC)", () => {
    const result = learnSchedulingPreferences([{ dentistId: "d1", startAt: "2026-08-05T14:00:00Z" }]);
    expect(result.preferredTimeOfDay).toBe("afternoon");
  });

  it("classifies the 17:00 boundary as evening, not afternoon", () => {
    const result = learnSchedulingPreferences([{ dentistId: "d1", startAt: "2026-08-05T17:00:00Z" }]);
    expect(result.preferredTimeOfDay).toBe("evening");
  });

  it("classifies evening (17:00-24:00 UTC)", () => {
    const result = learnSchedulingPreferences([{ dentistId: "d1", startAt: "2026-08-05T19:00:00Z" }]);
    expect(result.preferredTimeOfDay).toBe("evening");
  });

  it("picks the plurality time-of-day and dentist", () => {
    const result = learnSchedulingPreferences([
      { dentistId: "d1", startAt: "2026-08-05T09:00:00Z" },
      { dentistId: "d1", startAt: "2026-08-06T09:30:00Z" },
      { dentistId: "d2", startAt: "2026-08-07T15:00:00Z" },
    ]);
    expect(result.preferredTimeOfDay).toBe("morning");
    expect(result.preferredDentistId).toBe("d1");
    expect(result.sampleSize).toBe(3);
  });
});
