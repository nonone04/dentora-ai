"use client";

import { TimeGrid } from "@/components/calendar/time-grid";
import { getWeekDays, isSameDay } from "@/lib/calendar/date-grid";
import type { GridColumn } from "@/lib/calendar/grid-column";
import type { CalendarAppointment, CalendarTimeOff, CalendarWorkingHours } from "@/lib/calendar/types";
import { formatDayMonth, formatWeekdayShort } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * One column per day, every dentist's appointments merged and
 * color-coded together -- horizontal drag changes the day (see
 * lib/calendar/grid-column.ts); the dentist never changes, since the
 * Appointment Lifecycle Engine's reschedule transition only ever
 * touches start/end.
 */
export function WeekView({
  date,
  appointments,
  workingHours,
  timeOff,
  t,
  locale,
  pendingIds,
  onSlotClick,
  onAppointmentOpen,
  onReschedule,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  workingHours: CalendarWorkingHours[];
  timeOff: CalendarTimeOff[];
  t: Dictionary;
  locale: Locale;
  pendingIds: Set<string>;
  onSlotClick: (date: Date, dentistId?: string | null) => void;
  onAppointmentOpen: (appointment: CalendarAppointment) => void;
  onReschedule: (appointmentId: string, newStart: Date, newEnd: Date) => void;
}) {
  const now = new Date();
  const days = getWeekDays(date);
  const columns: GridColumn[] = days.map((day) => ({
    key: day.toDateString(),
    date: day,
    dentistId: null,
    label: `${formatWeekdayShort(day, locale)} ${formatDayMonth(day, locale)}`,
    color: null,
    isToday: isSameDay(day, now),
  }));

  return (
    <TimeGrid
      columns={columns}
      appointments={appointments}
      workingHours={workingHours}
      timeOff={timeOff}
      allowDayDrag
      t={t}
      locale={locale}
      pendingIds={pendingIds}
      onSlotClick={onSlotClick}
      onAppointmentOpen={onAppointmentOpen}
      onReschedule={onReschedule}
    />
  );
}
