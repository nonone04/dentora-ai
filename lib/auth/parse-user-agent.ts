export type ParsedUserAgent = {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
};

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/edg\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/chrome|crios/i, "Chrome"],
  [/firefox|fxios/i, "Firefox"],
  [/version\/.*safari/i, "Safari"],
  [/safari/i, "Safari"],
];

const OS_PATTERNS: [RegExp, string][] = [
  [/windows/i, "Windows"],
  // Checked before the macOS pattern: iPhone/iPad UAs include "like Mac OS X"
  // as a compatibility token, so this would otherwise never match.
  [/iphone|ipad|ipod/i, "iOS"],
  [/mac os x|macintosh/i, "macOS"],
  [/android/i, "Android"],
  [/linux/i, "Linux"],
];

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", deviceType: "unknown" };
  }

  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Unknown";
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Unknown";

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (/ipad|tablet/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|android/i.test(userAgent)) {
    deviceType = "mobile";
  }

  return { browser, os, deviceType };
}
