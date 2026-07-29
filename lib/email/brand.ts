/**
 * Hex equivalents of the OKLCH design tokens in app/globals.css, computed
 * once via the OKLab->linear-sRGB conversion (see scripts/oklch note in
 * docs/customer-communications.md) since email HTML renders outside
 * Tailwind/CSS-var context -- no @theme, no `oklch()` support in most
 * email clients. Kept as flat hex constants rather than re-deriving at
 * render time.
 *
 * A few tokens (success/info light, and the base brand teal used as body
 * text) are darkened a step relative to their in-app OKLCH value
 * specifically to clear WCAG AA 4.5:1 for normal-size text on white --
 * the in-app values are tuned for large UI accents against surrounding
 * chrome, not for isolated email body copy. See brand.test.ts.
 */
export const emailColors = {
  light: {
    pageBackground: "#f4f4f5",
    cardBackground: "#ffffff",
    text: "#171717",
    textMuted: "#5b5b5b",
    border: "#e5e5e5",
    brand: "#006e6f",
    brandAccent: "#008c8d",
    success: "#0a7e3a",
    warning: "#eba42c",
    warningForeground: "#3f2100",
    destructive: "#e7000b",
    info: "#007bad",
  },
  dark: {
    pageBackground: "#0a0a0a",
    cardBackground: "#171717",
    text: "#e5e5e5",
    textMuted: "#a1a1a1",
    border: "#2a2a2a",
    brand: "#2cb3b3",
    brandAccent: "#2cb3b3",
    success: "#43b966",
    warning: "#f5ae39",
    warningForeground: "#231200",
    destructive: "#ff6467",
    info: "#2ea4dc",
  },
} as const;

export type EmailColorScheme = keyof typeof emailColors;
export type EmailPalette = (typeof emailColors)[EmailColorScheme];

export const emailFontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** sRGB relative luminance per WCAG 2.x. */
function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(normalized.slice(0, 2), 16));
  const g = channel(parseInt(normalized.slice(2, 4), 16));
  const b = channel(parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, order-independent, in [1, 21]. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
