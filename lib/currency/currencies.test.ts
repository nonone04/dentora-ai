import { describe, expect, it } from "vitest";
import { CURRENCIES, CURRENCY_CODES, isCurrencyCode } from "@/lib/currency/currencies";
import { COUNTRY_TO_CURRENCY } from "@/lib/currency/country-map";
import { convert } from "@/lib/currency/convert";
import { formatCurrency } from "@/lib/currency/format";

describe("currency config", () => {
  it("every currency has a symbol, decimal digits and a positive rate", () => {
    for (const code of CURRENCY_CODES) {
      const meta = CURRENCIES[code];
      expect(meta.symbol.length).toBeGreaterThan(0);
      expect(meta.decimalDigits).toBeGreaterThanOrEqual(0);
      expect(meta.rateToMad).toBeGreaterThan(0);
    }
  });

  it("includes the 12 required currencies", () => {
    for (const code of ["MAD", "EUR", "USD", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "AED", "JPY"]) {
      expect(isCurrencyCode(code)).toBe(true);
    }
  });

  it("every COUNTRY_TO_CURRENCY value is a known currency", () => {
    for (const code of Object.values(COUNTRY_TO_CURRENCY)) {
      expect(isCurrencyCode(code)).toBe(true);
    }
  });

  it("convert is a no-op for the same currency and round-trips via the MAD pivot", () => {
    expect(convert(100, "MAD", "MAD")).toBe(100);
    const converted = convert(100, "USD", "EUR");
    const roundTripped = convert(converted, "EUR", "USD");
    expect(roundTripped).toBeCloseTo(100, 6);
  });

  it("formatCurrency renders JPY with 0 decimal digits", () => {
    expect(formatCurrency(1000, "JPY", "en-US")).not.toContain(".");
  });
});
