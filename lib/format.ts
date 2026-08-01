import type { Locale } from "@/lib/i18n/types";

/** Maps our 3 UI locales to concrete Intl locale tags. en/fr default to their -GB/-FR forms (24h clock, day-month-year) to match this app's original en-GB-only formatting; ar uses Morocco's Arabic locale, which formats dates with Western digits (matching the rest of the region-specific choices here) while still translating month/weekday names. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  ar: "ar-MA",
};

export function formatDateTime(iso: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Date-only, no time -- for plain SQL `date` columns like patients.date_of_birth. A bare "YYYY-MM-DD" string parses as UTC midnight in JS, which can shift a day in negative-offset timezones; appending a local-time marker avoids that. */
export function formatDate(iso: string, locale: Locale = "en") {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }).format(new Date(value));
}

export function formatTime(iso: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeStyle: "short" }).format(new Date(iso));
}

const RELATIVE_TIME_UNITS: { limitSeconds: number; divisorSeconds: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limitSeconds: 60, divisorSeconds: 1, unit: "second" },
  { limitSeconds: 3600, divisorSeconds: 60, unit: "minute" },
  { limitSeconds: 86400, divisorSeconds: 3600, unit: "hour" },
  { limitSeconds: 604800, divisorSeconds: 86400, unit: "day" },
];

const JUST_NOW_LABEL: Record<Locale, string> = {
  en: "just now",
  fr: "à l'instant",
  ar: "الآن",
};

/** "just now" / "5 minutes ago" / "3 hours ago" -- falls back to a plain date once it's more than a week old, where "N days ago" stops being a useful unit. */
export function formatRelativeTime(iso: string, locale: Locale = "en") {
  const deltaSeconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (deltaSeconds < 5) return JUST_NOW_LABEL[locale];

  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  for (const { limitSeconds, divisorSeconds, unit } of RELATIVE_TIME_UNITS) {
    if (deltaSeconds < limitSeconds) {
      return formatter.format(-Math.round(deltaSeconds / divisorSeconds), unit);
    }
  }

  return formatDateTime(iso, locale);
}

/** "Mon", "lun.", "الاثنين" depending on locale -- calendar day-column headers. */
export function formatWeekdayShort(date: Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short" }).format(date);
}

/** "12 Jul", "12 juil.", "12 يوليوز" -- calendar day-column headers, paired with formatWeekdayShort. */
export function formatDayMonth(date: Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short" }).format(date);
}

/** "July 2026" -- month view's header. */
export function formatMonthYear(date: Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric" }).format(date);
}

/** "Monday, 27 July 2026" -- day view's header. */
export function formatFullDate(date: Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** 0.734 -> "73%". Rounds to the nearest whole percent -- every rate in lib/analytics/lib/observability is a 0-1 fraction. */
export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** 245 -> "245 ms", 1850 -> "1.9 s", 125_000 -> "2 min 5 s" -- every latency_ms in lib/observability's trace is a plain millisecond integer. Uses Intl's unit formatting so the "ms"/"s"/"min" units themselves translate per locale, not just the number. */
export function formatDuration(ms: number, locale: Locale = "en") {
  const intlLocale = INTL_LOCALE[locale];
  const totalMs = Math.max(0, Math.round(ms));

  if (totalMs < 1000) {
    return new Intl.NumberFormat(intlLocale, { style: "unit", unit: "millisecond" }).format(totalMs);
  }

  const totalSeconds = totalMs / 1000;
  if (totalSeconds < 60) {
    const rounded = Math.round(totalSeconds * 10) / 10;
    return new Intl.NumberFormat(intlLocale, { style: "unit", unit: "second", maximumFractionDigits: 1 }).format(rounded);
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  const minutesLabel = new Intl.NumberFormat(intlLocale, { style: "unit", unit: "minute" }).format(minutes);
  if (seconds === 0) return minutesLabel;
  const secondsLabel = new Intl.NumberFormat(intlLocale, { style: "unit", unit: "second" }).format(seconds);
  return `${minutesLabel} ${secondsLabel}`;
}

/** Picks a service's name in the given UI locale, falling back through the other two translations rather than showing nothing. */
export function serviceName(nameTranslations: Record<string, string> | null | undefined, locale: Locale = "fr") {
  if (!nameTranslations) return "—";
  const order = locale === "ar" ? ["ar", "fr", "en"] : locale === "en" ? ["en", "fr", "ar"] : ["fr", "en", "ar"];
  for (const key of order) {
    if (nameTranslations[key]) return nameTranslations[key];
  }
  return "—";
}

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
};
