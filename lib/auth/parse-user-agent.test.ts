import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/auth/parse-user-agent";

describe("parseUserAgent", () => {
  it("returns unknown for a missing user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown", os: "Unknown", deviceType: "unknown" });
  });

  it("identifies desktop Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "macOS", deviceType: "desktop" });
  });

  it("identifies Safari on iPhone as mobile", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS", deviceType: "mobile" });
  });

  it("identifies Firefox on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Firefox", os: "Windows", deviceType: "desktop" });
  });

  it("identifies Edge on Windows distinctly from Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua).browser).toBe("Edge");
  });

  it("identifies Android as mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.os).toBe("Android");
    expect(result.deviceType).toBe("mobile");
  });

  it("identifies iPad as tablet", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1";
    expect(parseUserAgent(ua).deviceType).toBe("tablet");
  });
});
