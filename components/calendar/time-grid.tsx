"use client";

import { useMemo, useRef, useState } from "react";
import { AppointmentBlock } from "@/components/calendar/appointment-block";
import { checkConflictLocally } from "@/lib/calendar/conflict";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  gridHeightPx,
  gridHourMarks,
  minutesFromGridStart,
  minutesToPx,
  pxToMinutes,
  snapMinutes,
} from "@/lib/calendar/date-grid";
import { appointmentsForColumn, type GridColumn } from "@/lib/calendar/grid-column";
import { layoutDay } from "@/lib/calendar/layout";
import type { CalendarAppointment, CalendarTimeOff, CalendarWorkingHours } from "@/lib/calendar/types";
import { formatTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const GRID_MAX_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

type DragMode = "move" | "resize";

type DragState = {
  appointmentId: string;
  mode: DragMode;
  dentistId: string;
  originColumnKey: string;
  originStart: Date;
  originEnd: Date;
  previewStart: Date;
  previewEnd: Date;
  /** Fixed at drag start -- the reference point deltaMinutes is measured from. */
  startClientY: number;
  /** Which column the drag "ghost" currently renders in -- recomputed in the pointermove handler (never during render, so it never reads columnRefs outside an event handler). */
  targetColumnKey: string;
  conflict: boolean;
};

function toGridMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(":");
  return (Number(hoursStr) - DAY_START_HOUR) * 60 + Number(minutesStr ?? 0);
}

/**
 * Shared day/week time-grid: hour gridlines, working-hours/time-off
 * shading (day view only -- see lib/calendar/grid-column.ts for why
 * week view's merged-dentist columns can't shade unambiguously),
 * current-time line, and the pointer-based drag/resize that reschedules
 * appointments. The dragged appointment is rendered as a single
 * "ghost" block positioned independently of the target column's normal
 * overlap layout (which only recomputes once the server confirms the
 * move and fresh data streams back in) -- simplest way to give
 * instant visual feedback while dragging across columns in week view.
 */
export function TimeGrid({
  columns,
  appointments,
  workingHours,
  timeOff,
  allowDayDrag,
  t,
  locale,
  pendingIds,
  onSlotClick,
  onAppointmentOpen,
  onReschedule,
}: {
  columns: GridColumn[];
  appointments: CalendarAppointment[];
  workingHours: CalendarWorkingHours[];
  timeOff: CalendarTimeOff[];
  allowDayDrag: boolean;
  t: Dictionary;
  locale: Locale;
  pendingIds: Set<string>;
  onSlotClick: (date: Date, dentistId?: string | null) => void;
  onAppointmentOpen: (appointment: CalendarAppointment) => void;
  onReschedule: (appointmentId: string, newStart: Date, newEnd: Date) => void;
}) {
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const now = new Date();
  const gridHeight = gridHeightPx();
  const hourMarks = gridHourMarks();

  const draggedAppointment = drag ? appointments.find((a) => a.id === drag.appointmentId) ?? null : null;

  const columnAppointments = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const column of columns) {
      const list = appointmentsForColumn(appointments, column).filter((a) => a.id !== drag?.appointmentId);
      map.set(column.key, list);
    }
    return map;
  }, [columns, appointments, drag?.appointmentId]);

  function findColumnAt(clientX: number): GridColumn | null {
    for (const column of columns) {
      const el = columnRefs.current.get(column.key);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return column;
    }
    return null;
  }

  function beginDrag(event: React.PointerEvent<HTMLDivElement>, appointment: CalendarAppointment, mode: DragMode, originColumnKey: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      appointmentId: appointment.id,
      mode,
      dentistId: appointment.dentistId,
      originColumnKey,
      originStart: new Date(appointment.startAt),
      originEnd: new Date(appointment.endAt),
      previewStart: new Date(appointment.startAt),
      previewEnd: new Date(appointment.endAt),
      startClientY: event.clientY,
      targetColumnKey: originColumnKey,
      conflict: false,
    });
  }

  function updateDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const deltaMinutes = snapMinutes(pxToMinutes(event.clientY - drag.startClientY));

    let dayDeltaMs = 0;
    let targetColumnKey = drag.targetColumnKey;
    if (drag.mode === "move" && allowDayDrag) {
      const originColumn = columns.find((c) => c.key === drag.originColumnKey);
      const targetColumn = findColumnAt(event.clientX);
      if (originColumn && targetColumn) {
        dayDeltaMs = targetColumn.date.getTime() - originColumn.date.getTime();
        targetColumnKey = targetColumn.key;
      }
    }

    let previewStart: Date;
    let previewEnd: Date;
    if (drag.mode === "move") {
      previewStart = new Date(drag.originStart.getTime() + dayDeltaMs + deltaMinutes * 60_000);
      previewEnd = new Date(drag.originEnd.getTime() + dayDeltaMs + deltaMinutes * 60_000);
    } else {
      previewStart = drag.originStart;
      const minEnd = new Date(drag.originStart.getTime() + 5 * 60_000);
      const proposedEnd = new Date(drag.originEnd.getTime() + deltaMinutes * 60_000);
      previewEnd = proposedEnd < minEnd ? minEnd : proposedEnd;
    }

    const result = checkConflictLocally({
      dentistId: drag.dentistId,
      startAt: previewStart,
      endAt: previewEnd,
      excludeAppointmentId: drag.appointmentId,
      appointments,
      workingHours,
      timeOff,
    });

    setDrag({ ...drag, targetColumnKey, previewStart, previewEnd, conflict: !result.ok });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const changed = drag.previewStart.getTime() !== drag.originStart.getTime() || drag.previewEnd.getTime() !== drag.originEnd.getTime();
    if (changed && !drag.conflict) {
      onReschedule(drag.appointmentId, drag.previewStart, drag.previewEnd);
    } else if (!changed && drag.mode === "move") {
      const clicked = appointments.find((a) => a.id === drag.appointmentId);
      if (clicked) onAppointmentOpen(clicked);
    }
    setDrag(null);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
        <div />
        {columns.map((column) => (
          <div key={column.key} className={cn("flex min-w-0 items-center gap-1.5 border-s border-border px-2 py-2", column.isToday && "bg-brand/10")}>
            {column.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />}
            <span className={cn("truncate text-xs font-medium", column.isToday && "text-brand")}>{column.label}</span>
          </div>
        ))}
      </div>

      <div className="flex overflow-y-auto" style={{ maxHeight: "min(70vh, 720px)" }}>
        <div className="w-14 shrink-0 border-e border-border">
          {hourMarks.map((hour) => (
            <div key={hour} style={{ height: minutesToPx(60) }} className="relative">
              <span className="absolute -top-2.5 end-1.5 text-[10px] text-muted-foreground tabular-nums">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
          {columns.map((column) => {
            const dayOfWeek = column.date.getDay();
            const hoursToday = column.dentistId ? workingHours.filter((w) => w.dentistId === column.dentistId && w.dayOfWeek === dayOfWeek) : [];
            const timeOffToday = column.dentistId ? timeOff.filter((row) => row.dentistId === column.dentistId) : [];
            const positioned = layoutDay(columnAppointments.get(column.key) ?? []);
            const isToday = column.date.toDateString() === now.toDateString();
            const nowTopPx = isToday ? minutesToPx(Math.max(0, minutesFromGridStart(now))) : null;

            const openStartMinutes = hoursToday.length > 0 ? Math.min(...hoursToday.map((h) => toGridMinutes(h.startTime))) : null;
            const openEndMinutes = hoursToday.length > 0 ? Math.max(...hoursToday.map((h) => toGridMinutes(h.endTime))) : null;

            const showGhostHere = drag && draggedAppointment && drag.targetColumnKey === column.key;

            return (
              <div
                key={column.key}
                ref={(el) => {
                  if (el) columnRefs.current.set(column.key, el);
                  else columnRefs.current.delete(column.key);
                }}
                className="relative border-s border-border"
                style={{ height: gridHeight }}
                onClick={(event) => {
                  if (event.target !== event.currentTarget) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const minutes = snapMinutes(pxToMinutes(event.clientY - rect.top), 30);
                  const clicked = new Date(column.date);
                  clicked.setHours(DAY_START_HOUR, 0, 0, 0);
                  clicked.setMinutes(clicked.getMinutes() + minutes);
                  onSlotClick(clicked, column.dentistId);
                }}
                onPointerMove={drag ? updateDrag : undefined}
                onPointerUp={drag ? endDrag : undefined}
              >
                {column.dentistId && hoursToday.length === 0 && <div className="absolute inset-0 bg-muted/30" aria-hidden="true" />}
                {column.dentistId && openStartMinutes !== null && (
                  <div className="absolute inset-x-0 top-0 bg-muted/30" style={{ height: minutesToPx(Math.max(0, openStartMinutes)) }} aria-hidden="true" />
                )}
                {column.dentistId && openEndMinutes !== null && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-muted/30"
                    style={{ height: Math.max(0, gridHeight - minutesToPx(openEndMinutes)) }}
                    aria-hidden="true"
                  />
                )}
                {timeOffToday.map((row, i) => {
                  const start = Math.max(0, minutesFromGridStart(new Date(row.startAt)));
                  const end = Math.min(GRID_MAX_MINUTES, minutesFromGridStart(new Date(row.endAt)));
                  if (end <= start) return null;
                  return (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="absolute inset-x-0 bg-warning/15"
                      style={{ top: minutesToPx(start), height: minutesToPx(end - start) }}
                    />
                  );
                })}

                {hourMarks.slice(1).map((hour) => (
                  <div key={hour} className="absolute inset-x-0 border-t border-border/60" style={{ top: minutesToPx((hour - DAY_START_HOUR) * 60) }} aria-hidden="true" />
                ))}

                {nowTopPx !== null && (
                  <div className="absolute inset-x-0 z-20" style={{ top: nowTopPx }} aria-hidden="true">
                    <span className="block h-px bg-destructive" />
                  </div>
                )}

                {positioned.map(({ appointment, topPx, heightPx, column: col, columnCount }) => (
                  <AppointmentBlock
                    key={appointment.id}
                    appointment={appointment}
                    topPx={topPx}
                    heightPx={heightPx}
                    columnOffsetPercent={(col / columnCount) * 100}
                    columnWidthPercent={100 / columnCount}
                    t={t}
                    locale={locale}
                    isPending={pendingIds.has(appointment.id)}
                    onOpen={onAppointmentOpen}
                    onDragStart={(event) => beginDrag(event, appointment, "move", column.key)}
                    onResizeStart={(event) => beginDrag(event, appointment, "resize", column.key)}
                  />
                ))}

                {showGhostHere && draggedAppointment && drag && (
                  <AppointmentBlock
                    appointment={{ ...draggedAppointment, startAt: drag.previewStart.toISOString(), endAt: drag.previewEnd.toISOString() }}
                    topPx={minutesToPx(Math.max(0, minutesFromGridStart(drag.previewStart)))}
                    heightPx={Math.max(minutesToPx(minutesFromGridStart(drag.previewEnd) - minutesFromGridStart(drag.previewStart)), 18)}
                    columnOffsetPercent={0}
                    columnWidthPercent={100}
                    t={t}
                    locale={locale}
                    isDragging
                    isConflicting={drag.conflict}
                    onOpen={() => undefined}
                    onDragStart={() => undefined}
                    onResizeStart={() => undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {drag && (
        <div role="status" aria-live="polite" className="sr-only">
          {formatTime(drag.previewStart.toISOString(), locale)}
          {drag.conflict ? ` -- ${t.calendar.conflict.overlap}` : ""}
        </div>
      )}
    </div>
  );
}
