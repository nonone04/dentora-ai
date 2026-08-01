"use client";

import { Coins } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CURRENCY_CODES, useCurrency, type CurrencyCode } from "@/lib/currency";

/** Currency switcher for the pricing page, rendered beside the Monthly/Yearly toggle -- same dropdown-menu shape as components/language-switcher.tsx. Switching updates the currency cookie and refreshes so pricing-content.tsx recomputes every displayed price via convert()/formatCurrency(). */
export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Coins className="size-4" aria-hidden="true" />
        <span>{currency}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
          {CURRENCY_CODES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {code}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
