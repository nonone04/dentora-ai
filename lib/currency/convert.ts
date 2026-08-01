import { CURRENCIES, type CurrencyCode } from "@/lib/currency/currencies";

/** Converts `amount` between currencies via MAD as the pivot, using the static rates in lib/currency/currencies.ts. Not for computing money that's actually charged -- Stripe still bills the configured base-currency price (see lib/stripe/checkout.ts); this is for display/reporting conversions only. */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const amountInMad = amount * CURRENCIES[from].rateToMad;
  return amountInMad / CURRENCIES[to].rateToMad;
}
