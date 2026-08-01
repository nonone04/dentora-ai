import { type CurrencyCode } from "@/lib/currency/currencies";

/**
 * ISO 3166-1 alpha-2 country -> the supported currency it should default to.
 * Used both for geo-detection (proxy.ts, from the `x-vercel-ip-country`
 * header) and for auto-filling the Currency field from Country during
 * onboarding/Settings. A country not listed here simply has no auto-default
 * -- callers fall back to DEFAULT_CURRENCY (MAD).
 */
export const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  MA: "MAD",

  // Eurozone
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  IE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",

  US: "USD",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  CH: "CHF",
  LI: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  GL: "DKK",
  FO: "DKK",
  JP: "JPY",

  // Gulf countries -- no directly supported native currency, default to AED
  // as the nearest regionally-relevant one of the 12.
  AE: "AED",
  SA: "AED",
  QA: "AED",
  KW: "AED",
  BH: "AED",
  OM: "AED",
};

/** Display names for the Country <select> in onboarding and Regional Settings. Latin-script country names regardless of UI language, same convention as TIMEZONE_OPTIONS in lib/onboarding/clinic-options.ts. Superset of COUNTRY_TO_CURRENCY's keys plus a few neighboring markets with no currency auto-default. */
export const COUNTRY_NAMES: Record<string, string> = {
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  EG: "Egypt",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  IE: "Ireland",
  AT: "Austria",
  FI: "Finland",
  GR: "Greece",
  LU: "Luxembourg",
  SK: "Slovakia",
  SI: "Slovenia",
  EE: "Estonia",
  LV: "Latvia",
  LT: "Lithuania",
  CY: "Cyprus",
  MT: "Malta",
  HR: "Croatia",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  CH: "Switzerland",
  LI: "Liechtenstein",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  JP: "Japan",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
};

export const COUNTRY_CODES = Object.keys(COUNTRY_NAMES);
