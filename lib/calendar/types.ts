export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarAppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

/** Normalized shape every calendar view renders from -- flattened out of the joined appointments query so views don't each re-derive patient/dentist/service labels. */
export type CalendarAppointment = {
  id: string;
  clinicId: string;
  dentistId: string;
  dentistName: string;
  dentistColor: string | null;
  patientId: string | null;
  patientName: string;
  serviceId: string | null;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  status: CalendarAppointmentStatus;
  source: "staff" | "ai_assistant";
  notes: string | null;
};

export type CalendarDentist = {
  id: string;
  fullName: string;
  color: string | null;
  isActive: boolean;
};

export type CalendarService = {
  id: string;
  name: string;
  defaultDurationMinutes: number;
};

export type CalendarPatientOption = { id: string; fullName: string };

/** One weekly recurring working block, e.g. Monday 09:00-17:00 -- dentist_working_hours as-is. */
export type CalendarWorkingHours = { dentistId: string; dayOfWeek: number; startTime: string; endTime: string };

/** One approved time-off window -- dentist_time_off as-is. */
export type CalendarTimeOff = { dentistId: string; startAt: string; endAt: string };

export type CalendarFilters = {
  dentistIds: string[];
  statuses: CalendarAppointmentStatus[];
  search: string;
};

export function matchesFilters(appt: CalendarAppointment, filters: CalendarFilters): boolean {
  if (filters.dentistIds.length > 0 && !filters.dentistIds.includes(appt.dentistId)) return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(appt.status)) return false;
  if (filters.search.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = `${appt.patientName} ${appt.dentistName} ${appt.serviceName ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export const EMPTY_FILTERS: CalendarFilters = { dentistIds: [], statuses: [], search: "" };
