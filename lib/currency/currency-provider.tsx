"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCY_COOKIE_MAX_AGE_SECONDS, CURRENCY_COOKIE_NAME } from "@/lib/currency/config";
import type { CurrencyCode } from "@/lib/currency/currencies";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * Client-side half of the cookie-based currency system (see
 * lib/currency/get-currency.ts for the server-side half) -- same shape as
 * lib/i18n/locale-provider.tsx's LocaleProvider. `initialCurrency` comes
 * from the server-rendered root layout (which already read the cookie,
 * itself seeded by proxy.ts's geo-detection), so there's no flash of the
 * wrong currency on first paint. Switching currency updates local state
 * immediately and calls router.refresh() so Server Components -- which
 * read the cookie fresh on every request -- pick up the new currency too.
 */
export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: CurrencyCode;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency);
  const router = useRouter();

  const setCurrency = useCallback(
    (next: CurrencyCode) => {
      setCurrencyState(next);
      document.cookie = `${CURRENCY_COOKIE_NAME}=${next}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<CurrencyContextValue>(() => ({ currency, setCurrency }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}
