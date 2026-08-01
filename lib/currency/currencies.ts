/**
 * The single file to edit to add a new currency. `CurrencyCode` and
 * `CURRENCY_CODES` are derived from this object (same pattern as
 * `Locale`/`LOCALES` in lib/i18n/types.ts) so every other module -- the
 * marketing currency selector, onboarding/Settings <select>s, Stripe price
 * resolution -- picks up a new entry automatically without further changes.
 *
 * `rateToMad` is "how many MAD equal 1 unit of this currency", static and
 * manually updated (no live FX API/cron dependency -- see the currency
 * localization plan). MAD is the base currency all internal prices are
 * stored in (see lib/marketing/pricing-plans.ts).
 */
export const CURRENCIES = {
  MAD: { symbol: "DH", name: "Moroccan Dirham", decimalDigits: 2, rateToMad: 1 },
  EUR: { symbol: "€", name: "Euro", decimalDigits: 2, rateToMad: 10.9 },
  USD: { symbol: "$", name: "US Dollar", decimalDigits: 2, rateToMad: 9.4 },
  GBP: { symbol: "£", name: "British Pound", decimalDigits: 2, rateToMad: 12.6 },
  CAD: { symbol: "CA$", name: "Canadian Dollar", decimalDigits: 2, rateToMad: 6.9 },
  AUD: { symbol: "A$", name: "Australian Dollar", decimalDigits: 2, rateToMad: 6.2 },
  CHF: { symbol: "CHF", name: "Swiss Franc", decimalDigits: 2, rateToMad: 11.6 },
  SEK: { symbol: "kr", name: "Swedish Krona", decimalDigits: 2, rateToMad: 0.95 },
  NOK: { symbol: "kr", name: "Norwegian Krone", decimalDigits: 2, rateToMad: 0.92 },
  DKK: { symbol: "kr", name: "Danish Krone", decimalDigits: 2, rateToMad: 1.46 },
  AED: { symbol: "AED", name: "UAE Dirham", decimalDigits: 2, rateToMad: 2.56 },
  JPY: { symbol: "¥", name: "Japanese Yen", decimalDigits: 0, rateToMad: 0.063 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const BASE_CURRENCY: CurrencyCode = "MAD";

/** Alias for BASE_CURRENCY used at call sites that want "the fallback currency" rather than "the FX pivot" -- same value, different intent. */
export const DEFAULT_CURRENCY: CurrencyCode = BASE_CURRENCY;

export function isCurrencyCode(value: string | undefined | null): value is CurrencyCode {
  return !!value && (CURRENCY_CODES as readonly string[]).includes(value);
}
