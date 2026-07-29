import { describe, expect, it } from "vitest";
import { findDentistMatch, findServiceMatch, type ServiceCandidate } from "@/lib/ai/availability/match";

describe("findServiceMatch", () => {
  const services: ServiceCandidate[] = [
    { id: "svc-1", nameTranslations: { en: "Cleaning", fr: "Nettoyage", ar: "تنظيف" } },
    { id: "svc-2", nameTranslations: { en: "Root canal", fr: "Dévitalisation" } },
  ];

  it("matches on the English translation", () => {
    expect(findServiceMatch(services, "cleaning")).toBe("svc-1");
  });

  it("matches on the French translation", () => {
    expect(findServiceMatch(services, "nettoyage")).toBe("svc-1");
  });

  it("is case-insensitive", () => {
    expect(findServiceMatch(services, "CLEANING")).toBe("svc-1");
  });

  it("matches a substring, not just an exact name", () => {
    expect(findServiceMatch(services, "root")).toBe("svc-2");
  });

  it("returns null when nothing matches", () => {
    expect(findServiceMatch(services, "whitening")).toBeNull();
  });

  it("returns null for empty/null/undefined input", () => {
    expect(findServiceMatch(services, "")).toBeNull();
    expect(findServiceMatch(services, null)).toBeNull();
    expect(findServiceMatch(services, undefined)).toBeNull();
  });

  it("skips a service with no translations rather than throwing", () => {
    const withGap = [{ id: "svc-3", nameTranslations: null }, ...services];
    expect(findServiceMatch(withGap, "cleaning")).toBe("svc-1");
  });
});

describe("findDentistMatch", () => {
  const dentists = [
    { id: "dentist-1", fullName: "Amrani Youssef" },
    { id: "dentist-2", fullName: "Sara Bennis" },
  ];

  it("matches ignoring NLU's 'Dr.' prefix", () => {
    expect(findDentistMatch(dentists, "Dr. Amrani")).toBe("dentist-1");
  });

  it("matches ignoring the French 'Docteur' prefix", () => {
    expect(findDentistMatch(dentists, "Docteur Bennis")).toBe("dentist-2");
  });

  it("matches even without any title prefix", () => {
    expect(findDentistMatch(dentists, "Bennis")).toBe("dentist-2");
  });

  it("is case-insensitive", () => {
    expect(findDentistMatch(dentists, "dr. amrani")).toBe("dentist-1");
  });

  it("returns null when nothing matches", () => {
    expect(findDentistMatch(dentists, "Dr. Nobody")).toBeNull();
  });

  it("returns null for empty/null/undefined input", () => {
    expect(findDentistMatch(dentists, "")).toBeNull();
    expect(findDentistMatch(dentists, null)).toBeNull();
    expect(findDentistMatch(dentists, undefined)).toBeNull();
  });
});
