"use client";

import { TimeGrid } from "@/components/calendar/time-grid";
import { dentistColor } from "@/lib/calendar/colors";
import { isSameDay } from "@/lib/calendar/date-grid";
import type { GridColumn } from "@/lib/calendar/grid-column";
import type { CalendarAppointment, CalendarDentist, CalendarTimeOff, CalendarWorkingHours } from "@/lib/calendar/types";
import type { Dictionary, Locale } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

/**
 * One column per active dentist -- horizontal drag is locked to the
 * origin column (see lib/calendar/grid-column.ts), so this view only
 * ever reschedules time, never reassigns the dentist.
 */
export function DayView({
  date,
  dentists,
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
  dentists: CalendarDentist[];
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
  const isToday = isSameDay(date, new Date());
  const columns: GridColumn[] = dentists
    .filter((d) => d.isActive)
    .map((d) => ({ key: d.id, date, dentistId: d.id, label: d.fullName, color: dentistColor(d.id, d.color), isToday }));

  if (columns.length === 0) {
    return (
      <div className="rounded-xl ring-1 ring-foreground/10">
        <EmptyState icon={Users} title={t.dentists.empty} description={t.dentists.description} />
      </div>
    );
  }

  return (
    <TimeGrid
      columns={columns}
      appointments={appointments}
      workingHours={workingHours}
      timeOff={timeOff}
      allowDayDrag={false}
      t={t}
      locale={locale}
      pendingIds={pendingIds}
      onSlotClick={onSlotClick}
      onAppointmentOpen={onAppointmentOpen}
      onReschedule={onReschedule}
    />
  );
}
