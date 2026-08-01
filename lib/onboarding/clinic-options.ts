// Ordered so the <select> renders general dentistry first, specialties after --
// the values themselves are stored in clinics.clinic_type and read back by
// lib/ai/tools/get-clinic-info.ts, so they stay stable regardless of locale.
export const CLINIC_TYPE_KEYS = [
  "general",
  "orthodontics",
  "pediatric",
  "oralSurgery",
  "periodontics",
  "endodontics",
  "cosmetic",
  "multiSpecialty",
] as const;

export type ClinicTypeKey = (typeof CLINIC_TYPE_KEYS)[number];

// IANA identifiers are kept in Latin script across locales (the same
// convention Notion/Vercel/Linear use for timezone pickers) -- translating
// "Africa/Casablanca" would make it unrecognizable. Casablanca leads since
// it's the table's default (see clinics.timezone in the init migration).
export const TIMEZONE_OPTIONS = [
  { value: "Africa/Casablanca", label: "Africa/Casablanca (GMT+1)" },
  { value: "Africa/Algiers", label: "Africa/Algiers (GMT+1)" },
  { value: "Africa/Tunis", label: "Africa/Tunis (GMT+1)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (GMT+2)" },
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (GMT+1)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+4)" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (GMT+3)" },
  { value: "America/New_York", label: "America/New York (GMT-5)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (GMT-8)" },
] as const;

export const DEFAULT_CLINIC_TIMEZONE = "Africa/Casablanca";

// Values are literal date-format patterns (not translated) since they're
// also used directly to render dates via a formatting library -- the
// label shows the pattern applied to a sample date so it's self-explanatory
// regardless of UI language.
export const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-31)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (31.12.2026)" },
] as const;

export const DEFAULT_CLINIC_DATE_FORMAT = "DD/MM/YYYY";

// Curated Intl locale tags used purely for number/currency grouping and
// decimal conventions -- deliberately decoupled from the UI language
// (default_language) and from the clinic's own display locale. Label shows
// a live example so the choice is obvious without knowing Intl locale tags.
export const NUMBER_FORMAT_OPTIONS = [
  { value: "fr-FR", label: "1 234,56 (French)" },
  { value: "en-US", label: "1,234.56 (US)" },
  { value: "en-GB", label: "1,234.56 (UK)" },
  { value: "de-DE", label: "1.234,56 (German)" },
  { value: "ar-MA", label: "1٬234٫56 (Arabic - Morocco)" },
] as const;

export const DEFAULT_CLINIC_NUMBER_FORMAT = "fr-FR";
