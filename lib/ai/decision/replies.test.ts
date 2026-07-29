import { describe, expect, it } from "vitest";
import { buildEmergencyReply, buildEscalationReply, buildGreetingReply } from "@/lib/ai/decision/replies";

describe("buildGreetingReply", () => {
  it("defaults to English", () => {
    expect(buildGreetingReply()).toBe("Hello! How can I help you today?");
  });

  it("responds in French", () => {
    expect(buildGreetingReply({ language: "fr" })).toContain("Bonjour");
  });

  it("responds in Arabic", () => {
    expect(buildGreetingReply({ language: "ar" })).toContain("مرحبا");
  });

  it("falls back to the clinic's default language when the detected language is unsupported", () => {
    expect(buildGreetingReply({ language: "other", clinicDefaultLanguage: "fr" })).toContain("Bonjour");
  });
});

describe("buildEscalationReply", () => {
  it("defaults to English", () => {
    expect(buildEscalationReply()).toContain("connecting you with our team");
  });

  it("responds in French", () => {
    expect(buildEscalationReply({ language: "fr" })).toContain("notre équipe");
  });

  it("responds in Arabic", () => {
    expect(buildEscalationReply({ language: "ar" })).toContain("فريقنا");
  });
});

describe("buildEmergencyReply", () => {
  it("always includes safety guidance to call emergency services, in every supported language", () => {
    expect(buildEmergencyReply({ language: "en" })).toContain("emergency services");
    expect(buildEmergencyReply({ language: "fr" })).toContain("urgences");
    expect(buildEmergencyReply({ language: "ar" })).toContain("الطوارئ");
  });

  it("falls back to English when neither the detected nor the clinic's default language is recognized", () => {
    expect(buildEmergencyReply({ language: "other", clinicDefaultLanguage: undefined })).toContain("emergency services");
  });
});
