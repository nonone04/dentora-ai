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
