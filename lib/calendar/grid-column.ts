import { isSameDay } from "@/lib/calendar/date-grid";
import type { CalendarAppointment } from "@/lib/calendar/types";

/**
 * One vertical column of the day/week time grid. Day view uses one
 * column per active dentist (dentistId set, date fixed to the selected
 * day) so working-hours/time-off shading is unambiguous per column;
 * week view uses one column per day (dentistId null -- every dentist's
 * appointments merged and color-coded together, date varies). See
 * components/calendar/time-grid.tsx for why drag behaves differently
 * between the two: reassigning a dentist via drag isn't something the
 * Appointment Lifecycle Engine's reschedule transition supports (it
 * only ever changes start/end), so day view locks horizontal movement
 * to the origin column instead of interpreting it as a dentist change.
 */
export type GridColumn = {
  key: string;
  date: Date;
  dentistId: string | null;
  label: string;
  color: string | null;
  isToday?: boolean;
};

export function appointmentsForColumn(appointments: CalendarAppointment[], column: GridColumn): CalendarAppointment[] {
  return appointments.filter((appt) => {
    if (!isSameDay(new Date(appt.startAt), column.date)) return false;
    if (column.dentistId && appt.dentistId !== column.dentistId) return false;
    return true;
  });
}
