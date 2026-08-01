import { cookies } from "next/headers";
import { CURRENCY_COOKIE_NAME } from "@/lib/currency/config";
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from "@/lib/currency/currencies";

/** Server-side currency read -- mirrors lib/i18n/get-locale.ts's getServerLocale(). Every Server Component that needs to format money reads it from here instead of touching the cookie directly. Never throws: an absent/invalid cookie just falls back to DEFAULT_CURRENCY (proxy.ts sets the cookie from geo-detection before this is ever reached, so the fallback mainly matters for local dev). */
export async function getServerCurrency(): Promise<CurrencyCode> {
  const store = await cookies();
  const value = store.get(CURRENCY_COOKIE_NAME)?.value;
  return isCurrencyCode(value) ? value : DEFAULT_CURRENCY;
}
