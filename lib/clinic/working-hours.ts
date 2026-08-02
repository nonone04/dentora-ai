// Clinic-level weekly working hours -- stored in clinics.settings.workingHours
// (same jsonb-preferences convention as notifications/AI settings, see
// lib/notifications/settings.ts) rather than a dedicated column, since it's
// a single lightly-structured block never queried outside the Settings page.
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type DayWorkingHours = {
  day: Weekday;
  closed: boolean;
  openTime: string;
  closeTime: string;
};

export type ClinicWorkingHours = DayWorkingHours[];

export const DEFAULT_OPEN_TIME = "09:00";
export const DEFAULT_CLOSE_TIME = "18:00";

export function defaultWorkingHours(): ClinicWorkingHours {
  return WEEKDAYS.map((day) => ({
    day,
    closed: day === "sun",
    openTime: DEFAULT_OPEN_TIME,
    closeTime: DEFAULT_CLOSE_TIME,
  }));
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDay(entry: unknown): entry is DayWorkingHours {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.day === "string" &&
    (WEEKDAYS as readonly string[]).includes(e.day) &&
    typeof e.closed === "boolean" &&
    typeof e.openTime === "string" &&
    typeof e.closeTime === "string"
  );
}

/** Parses+validates clinics.settings.workingHours, falling back to sane defaults for anything missing or malformed rather than failing the whole read. */
export function getClinicWorkingHours(clinicSettings: Record<string, unknown> | null | undefined): ClinicWorkingHours {
  const raw = clinicSettings?.workingHours;
  if (!Array.isArray(raw)) return defaultWorkingHours();

  const byDay = new Map<string, DayWorkingHours>();
  for (const entry of raw) {
    if (isValidDay(entry)) byDay.set(entry.day, entry);
  }

  return WEEKDAYS.map(
    (day) => byDay.get(day) ?? { day, closed: day === "sun", openTime: DEFAULT_OPEN_TIME, closeTime: DEFAULT_CLOSE_TIME },
  );
}

/** Builds a validated ClinicWorkingHours array from form input, one row per weekday. Throws nothing -- invalid times just fall back to the defaults for that day. */
export function parseWorkingHoursFromForm(formData: FormData): ClinicWorkingHours {
  return WEEKDAYS.map((day) => {
    const closed = formData.get(`workingHours.${day}.closed`) === "on";
    const openRaw = formData.get(`workingHours.${day}.open`);
    const closeRaw = formData.get(`workingHours.${day}.close`);
    const openTime = typeof openRaw === "string" && TIME_RE.test(openRaw) ? openRaw : DEFAULT_OPEN_TIME;
    const closeTime = typeof closeRaw === "string" && TIME_RE.test(closeRaw) ? closeRaw : DEFAULT_CLOSE_TIME;
    return { day, closed, openTime, closeTime };
  });
}
