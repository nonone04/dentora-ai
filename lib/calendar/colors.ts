/**
 * Fallback palette for dentists with no explicit `dentists.color` set --
 * color coding must always work, not just when staff remembered to pick
 * one. Chosen to read clearly against both the light and dark card
 * backgrounds (see app/globals.css) and against each other.
 */
const FALLBACK_PALETTE = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#db2777", // pink
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#dc2626", // red
  "#65a30d", // lime
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Stable per-dentist color: their own `color` if set, otherwise a deterministic palette pick keyed by id (same dentist always gets the same fallback color, even across renders/reloads). */
export function dentistColor(dentistId: string, explicitColor?: string | null): string {
  if (explicitColor) return explicitColor;
  return FALLBACK_PALETTE[hashString(dentistId) % FALLBACK_PALETTE.length];
}

/** A readable foreground for text/icons placed directly on a `dentistColor()` background, via relative luminance. */
export function readableForeground(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}
