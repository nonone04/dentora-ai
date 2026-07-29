"use client";

import { GripHorizontal } from "lucide-react";
import { dentistColor, readableForeground } from "@/lib/calendar/colors";
import type { CalendarAppointment } from "@/lib/calendar/types";
import { formatTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_OPACITY: Record<CalendarAppointment["status"], string> = {
  scheduled: "opacity-90",
  confirmed: "opacity-100",
  completed: "opacity-60",
  cancelled: "opacity-40 line-through",
  no_show: "opacity-50",
};

export function AppointmentBlock({
  appointment,
  topPx,
  heightPx,
  columnWidthPercent,
  columnOffsetPercent,
  t,
  locale,
  isDragging,
  isPending,
  isConflicting,
  onOpen,
  onDragStart,
  onResizeStart,
}: {
  appointment: CalendarAppointment;
  topPx: number;
  heightPx: number;
  columnWidthPercent: number;
  columnOffsetPercent: number;
  t: Dictionary;
  locale: Locale;
  isDragging?: boolean;
  isPending?: boolean;
  isConflicting?: boolean;
  onOpen: (appointment: CalendarAppointment) => void;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>, appointment: CalendarAppointment) => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>, appointment: CalendarAppointment) => void;
}) {
  const color = dentistColor(appointment.dentistId, appointment.dentistColor);
  const fg = readableForeground(color);
  const compact = heightPx < 36;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${appointment.patientName} · ${appointment.dentistName} · ${formatTime(appointment.startAt, locale)} · ${t.appointmentStatus[appointment.status]}`}
      title={t.calendar.a11y.dragHint}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-md px-1.5 py-1 text-start text-xs shadow-sm outline-none ring-1 ring-black/10 transition-shadow focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing",
        STATUS_OPACITY[appointment.status],
        isDragging && "z-30 shadow-lg ring-2",
        isConflicting && "ring-2 ring-destructive",
        isPending && "animate-pulse",
      )}
      style={{
        top: topPx,
        height: Math.max(heightPx, 18),
        insetInlineStart: `${columnOffsetPercent}%`,
        width: `calc(${columnWidthPercent}% - 4px)`,
        backgroundColor: color,
        color: fg,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        onDragStart(event, appointment);
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(appointment);
        }
      }}
    >
      <div className={cn("flex min-w-0 items-center gap-1", compact && "flex-row justify-between")}>
        <span className="truncate font-medium">{appointment.patientName || t.calendar.detail.title}</span>
        {!compact && <span className="shrink-0 text-[10px] opacity-90">{formatTime(appointment.startAt, locale)}</span>}
      </div>
      {!compact && (
        <span className="truncate text-[10px] opacity-90">
          {appointment.dentistName}
          {appointment.serviceName ? ` · ${appointment.serviceName}` : ""}
        </span>
      )}
      <div
        role="separator"
        aria-label={t.calendar.a11y.resizeHandle}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 group-hover:opacity-70"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.button !== 0) return;
          onResizeStart(event, appointment);
        }}
      >
        <GripHorizontal className="size-3" aria-hidden="true" />
      </div>
    </div>
  );
}
