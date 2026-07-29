import { describe, expect, it } from "vitest";
import { contrastRatio, emailColors } from "@/lib/email/brand";

describe("contrastRatio", () => {
  it("is 1 for identical colors and 21 for black/white", () => {
    expect(contrastRatio("#000000", "#000000")).toBeCloseTo(1, 2);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#171717", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#171717"), 5);
  });
});

describe("email color pairs meet WCAG AA", () => {
  const NORMAL_TEXT_MIN = 4.5;
  const LARGE_TEXT_MIN = 3;

  it.each(["light", "dark"] as const)("%s: body text on card background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    expect(contrastRatio(c.text, c.cardBackground)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it.each(["light", "dark"] as const)("%s: muted text on card background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    expect(contrastRatio(c.textMuted, c.cardBackground)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it.each(["light", "dark"] as const)("%s: interactive brand text/link on card background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    expect(contrastRatio(c.brand, c.cardBackground)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it("light: large brand-accent wordmark on card background clears 3:1 (large-text threshold)", () => {
    const c = emailColors.light;
    expect(contrastRatio(c.brandAccent, c.cardBackground)).toBeGreaterThanOrEqual(LARGE_TEXT_MIN);
  });

  it.each(["light", "dark"] as const)("%s: button text on button background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    const buttonText = scheme === "dark" ? emailColors.light.text : "#ffffff";
    expect(contrastRatio(buttonText, c.brand)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it.each(["light", "dark"] as const)("%s: destructive text on card background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    expect(contrastRatio(c.destructive, c.cardBackground)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });

  it.each(["light", "dark"] as const)("%s: warning-foreground on warning background clears 4.5:1", (scheme) => {
    const c = emailColors[scheme];
    expect(contrastRatio(c.warningForeground, c.warning)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });
});
