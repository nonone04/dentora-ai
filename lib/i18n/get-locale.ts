import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/types";

/** Server-side locale read -- every Server Component (pages, dashboard widgets, layout) calls this instead of touching the cookie directly. Never throws: an absent/invalid cookie just falls back to the default locale. */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
