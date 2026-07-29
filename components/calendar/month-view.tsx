"use client";

import { dentistColor } from "@/lib/calendar/colors";
import { getMonthGrid, isSameDay } from "@/lib/calendar/date-grid";
import type { CalendarAppointment } from "@/lib/calendar/types";
import { formatTime, formatWeekdayShort } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_CHIPS_PER_DAY = 3;

/**
 * A day/dentist-agnostic overview grid -- appointments across every
 * dentist appear together, color-coded, with a "+N more" overflow
 * rather than trying to cram a full day's schedule into a small cell.
 * No drag-and-drop here (a month cell has no time axis to drop onto);
 * clicking a day jumps to Day view, where dragging/resizing works.
 */
export function MonthView({
  date,
  appointments,
  t,
  locale,
  onDayClick,
  onAppointmentOpen,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  t: Dictionary;
  locale: Locale;
  onDayClick: (date: Date) => void;
  onAppointmentOpen: (appointment: CalendarAppointment) => void;
}) {
  const now = new Date();
  const grid = getMonthGrid(date);
  const currentMonth = date.getMonth();

  const weekdayLabels = grid.slice(0, 7).map((day) => formatWeekdayShort(day, locale));

  const appointmentsByDay = new Map<string, CalendarAppointment[]>();
  for (const appt of appointments) {
    const key = new Date(appt.startAt).toDateString();
    const list = appointmentsByDay.get(key) ?? [];
    list.push(appt);
    appointmentsByDay.set(key, list);
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day) => {
          const key = day.toDateString();
          const dayAppointments = (appointmentsByDay.get(key) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt));
          const visible = dayAppointments.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayAppointments.length - visible.length;
          const inMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, now);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-e border-b border-border p-1.5 text-start align-top hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&:nth-child(7n)]:border-e-0",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                  isToday && "bg-brand text-brand-foreground font-semibold",
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((appt) => (
                  <span
                    key={appt.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAppointmentOpen(appt);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        event.preventDefault();
                        onAppointmentOpen(appt);
                      }
                    }}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-start text-[10px] outline-none hover:opacity-80 focus-visible:ring-1 focus-visible:ring-ring"
                    style={{ backgroundColor: `${dentistColor(appt.dentistId, appt.dentistColor)}20` }}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: dentistColor(appt.dentistId, appt.dentistColor) }}
                    />
                    <span className="truncate">
                      {formatTime(appt.startAt, locale)} {appt.patientName}
                    </span>
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-[10px] text-muted-foreground">{interpolate(t.calendar.more, { count: overflow })}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
