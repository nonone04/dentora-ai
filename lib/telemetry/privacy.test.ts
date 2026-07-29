import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeProperties } from "@/lib/telemetry/privacy";

describe("sanitizeProperties", () => {
  it("passes a clean payload through unchanged", () => {
    const properties = { feature: "calendar", count: 3, ok: true };
    expect(sanitizeProperties(properties)).toEqual(properties);
  });

  describe("in development/test", () => {
    it("throws when a denylisted key is present", () => {
      expect(() => sanitizeProperties({ message: "hi" })).toThrow(/denylisted/i);
      expect(() => sanitizeProperties({ patientNotes: "x", notes: "y" })).toThrow(/notes/);
    });
  });

  describe("in production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("strips denylisted keys instead of throwing", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = sanitizeProperties({ feature: "calendar", token: "secret-value" });
      expect(result).toEqual({ feature: "calendar" });
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it("is case-insensitive on key names", () => {
    expect(() => sanitizeProperties({ Password: "x" })).toThrow();
  });
});
