"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { directionForLocale, type Dictionary, type Locale } from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Client-side half of the cookie-based i18n system (see
 * lib/i18n/get-locale.ts for the server-side half). Deliberately not
 * URL/routing-based -- this app's routes are already clinic-scoped
 * (/clinic/[clinicId]/...) with their own auth proxy (proxy.ts), and
 * adding locale path prefixes would mean reworking that. A cookie is
 * simpler and keeps every existing route untouched.
 *
 * `initialLocale` comes from the server-rendered root layout (which
 * already read the cookie for the `dir`/`lang` attributes), so there's
 * no flash of the wrong language on first paint. Switching locale
 * updates local state immediately (client components re-render right
 * away) and calls router.refresh() so Server Components -- which read
 * the cookie fresh on every request -- pick up the new dictionary too.
 */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dictionary: getDictionary(locale), direction: directionForLocale(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within a LocaleProvider");
  return context;
}

/** Convenience alias for the common case of just wanting the dictionary. */
export function useTranslations(): Dictionary {
  return useLocale().dictionary;
}
