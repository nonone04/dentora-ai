import { isWithinWorkingHours, rangesOverlap, type WorkingHoursBlock } from "@/lib/ai/availability";
import { toISODate } from "@/lib/calendar/date-grid";
import type { CalendarAppointment, CalendarTimeOff, CalendarWorkingHours } from "@/lib/calendar/types";

export type LocalConflictResult =
  | { ok: true }
  | { ok: false; reason: "outside_hours" | "time_off" | "overlap" };

/**
 * Instant, client-side conflict check reusing the exact same pure
 * primitives (isWithinWorkingHours/rangesOverlap) the server-side
 * checkConflictAction and the AI assistant's own reschedule tool use --
 * this just runs them against data already loaded into the browser, so
 * dragging gets live feedback on every pointer move instead of a
 * round trip per pixel. The server re-validates authoritatively on
 * drop (see rescheduleAppointmentAction) since this client-side copy of
 * the schedule can go stale between loads.
 */
export function checkConflictLocally(params: {
  dentistId: string;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
  appointments: CalendarAppointment[];
  workingHours: CalendarWorkingHours[];
  timeOff: CalendarTimeOff[];
}): LocalConflictResult {
  const date = toISODate(params.startAt);
  const dayOfWeek = params.startAt.getDay();

  const workingHoursBlocks: WorkingHoursBlock[] = params.workingHours
    .filter((row) => row.dentistId === params.dentistId && row.dayOfWeek === dayOfWeek)
    .map((row) => ({ startTime: row.startTime, endTime: row.endTime }));

  if (!isWithinWorkingHours(params.startAt, params.endAt, date, workingHoursBlocks)) {
    return { ok: false, reason: "outside_hours" };
  }

  const timeOffHit = params.timeOff
    .filter((row) => row.dentistId === params.dentistId)
    .some((row) => rangesOverlap(params.startAt, params.endAt, new Date(row.startAt), new Date(row.endAt)));
  if (timeOffHit) return { ok: false, reason: "time_off" };

  const overlapHit = params.appointments
    .filter(
      (appt) =>
        appt.dentistId === params.dentistId && appt.id !== params.excludeAppointmentId && appt.status !== "cancelled",
    )
    .some((appt) => rangesOverlap(params.startAt, params.endAt, new Date(appt.startAt), new Date(appt.endAt)));
  if (overlapHit) return { ok: false, reason: "overlap" };

  return { ok: true };
}
