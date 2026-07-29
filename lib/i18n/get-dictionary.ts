import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import type { Dictionary, Locale } from "@/lib/i18n/types";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar };

/** Pure, synchronous lookup -- safe to call from both server and client code. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Fills `{placeholder}` tokens in a translated string, e.g.
 * interpolate(t.dashboard.schedule.appointmentCountOther, { count: 3 })
 * -> "3 appointments". Deliberately minimal (no pluralization rules,
 * ICU, etc.) -- every dictionary string that needs a count already
 * picks the right *One/*Other key itself; this only substitutes values.
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** count === 1 picks the singular key, otherwise the plural key -- used for the couple of dictionary strings with an *One/*Other pair (English/French both only need two forms; Arabic's dual/plural forms would need more, but this pair is only ever used for compact schedule counts where the numeral itself alongside the noun does the job). */
export function pluralize(count: number, one: string, other: string, values?: Record<string, string | number>): string {
  const template = count === 1 ? one : other;
  return interpolate(template, { count, ...values });
}
