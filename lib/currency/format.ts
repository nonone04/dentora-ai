import { CURRENCIES, type CurrencyCode } from "@/lib/currency/currencies";

/**
 * Formats `amount` in `currency`. `localeTag` controls digit grouping and
 * decimal separator conventions only (e.g. "1,234.56" vs "1 234,56") -- it's
 * deliberately a raw Intl locale tag, not the 3-value UI `Locale` type,
 * since a clinic's number-format preference (clinics.number_format,
 * lib/currency/config.ts) is independent of both its UI language and its
 * currency. Pass `INTL_LOCALE[uiLocale]` (lib/format.ts) when there's no
 * clinic preference to read yet, e.g. on the marketing site.
 */
export function formatCurrency(amount: number, currency: CurrencyCode, localeTag = "en-US"): string {
  const { decimalDigits } = CURRENCIES[currency];
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency,
    minimumFractionDigits: decimalDigits,
    maximumFractionDigits: decimalDigits,
  }).format(amount);
}
