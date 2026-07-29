import { describe, expect, it } from "vitest";
import { scorePasswordStrength, validatePassword } from "@/lib/auth/password";

describe("validatePassword", () => {
  it("rejects passwords under 8 characters", () => {
    expect(validatePassword("short1")).toEqual({ ok: false, code: "too_short" });
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password1")).toEqual({ ok: false, code: "common_password" });
  });

  it("rejects a password matching the email local part", () => {
    expect(validatePassword("walidhourmatallah", "walidhourmatallah@example.com")).toEqual({
      ok: false,
      code: "matches_email",
    });
  });

  it("accepts a reasonably strong password", () => {
    expect(validatePassword("Tr0ub4dor&3xyz")).toEqual({ ok: true });
  });

  it("is case-insensitive when matching the email local part", () => {
    expect(validatePassword("Walid@2026", "walid@example.com").ok).toBe(true);
  });
});

describe("scorePasswordStrength", () => {
  it("scores an empty password as 0", () => {
    expect(scorePasswordStrength("")).toBe(0);
  });

  it("scores a common password as 0 regardless of length", () => {
    expect(scorePasswordStrength("qwertyuiop")).toBe(0);
  });

  it("scores increase with length and character variety", () => {
    const weak = scorePasswordStrength("aaaaaaaa");
    const strong = scorePasswordStrength("Xk9!mQ2p#Lz7vR@1");
    expect(strong).toBeGreaterThan(weak);
  });

  it("never exceeds 4", () => {
    expect(scorePasswordStrength("Xk9!mQ2p#Lz7vR@1WithExtraLength")).toBeLessThanOrEqual(4);
  });
});
