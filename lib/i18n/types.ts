import type { en } from "@/lib/i18n/dictionaries/en";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function directionForLocale(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

/**
 * The shape every dictionary must satisfy, derived from en.ts (the
 * source of truth) rather than hand-duplicated -- fr.ts/ar.ts declare
 * `satisfies Dictionary`, so a missing or extra key in either is a
 * compile error instead of a silent runtime fallback.
 */
export type Dictionary = typeof en;
