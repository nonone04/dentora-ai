"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarX } from "lucide-react";
import { getCalendarData, rescheduleAppointmentAction, type CalendarData } from "@/app/actions/calendar";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { AppointmentDetailDialog } from "@/components/calendar/appointment-detail-dialog";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays, addMonths, getMonthGrid, startOfDay, startOfWeek } from "@/lib/calendar/date-grid";
import {
  EMPTY_FILTERS,
  matchesFilters,
  type CalendarAppointment,
  type CalendarAppointmentStatus,
  type CalendarFilters,
  type CalendarView,
} from "@/lib/calendar/types";
import { formatDayMonth, formatFullDate, formatMonthYear, formatTime } from "@/lib/format";
import { interpolate, useLocale, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** No Postgres Realtime publication backs this (adding one is a schema change, out of scope) -- background polling plus a refetch on focus/visibility keeps the calendar in sync with changes made elsewhere (the plain appointments page, the AI assistant) without the user having to reload. */
const POLL_INTERVAL_MS = 60_000;

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

function rangeFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  const grid = getMonthGrid(anchor);
  return { from: grid[0], to: addDays(grid[0], 42) };
}

export function CalendarPageClient({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [newAppointmentDefaults, setNewAppointmentDefaults] = useState<{ startAt?: Date; dentistId?: string }>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const pushToast = useCallback((message: string, variant: ToastVariant) => {
    const id = ++toastCounter.current;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await getCalendarData(clinicId, fromIso, toIso);
      setData(result);
      setError(false);
    } catch {
      setError(true);
    }
  }, [clinicId, fromIso, toIso]);

  useEffect(() => {
    let cancelled = false;
    getCalendarData(clinicId, fromIso, toIso).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(false);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [clinicId, fromIso, toIso]);

  useEffect(() => {
    const interval = setInterval(() => load(), POLL_INTERVAL_MS);
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const filteredAppointments = useMemo(() => {
    if (!data) return [];
    return data.appointments.filter((appt) => matchesFilters(appt, filters));
  }, [data, filters]);

  function handlePrev() {
    setAnchor((current) => (view === "day" ? addDays(current, -1) : view === "week" ? addDays(current, -7) : addMonths(current, -1)));
  }
  function handleNext() {
    setAnchor((current) => (view === "day" ? addDays(current, 1) : view === "week" ? addDays(current, 7) : addMonths(current, 1)));
  }
  function handleToday() {
    setAnchor(new Date());
  }

  function toggleDentist(id: string) {
    setFilters((current) => ({
      ...current,
      dentistIds: current.dentistIds.includes(id) ? current.dentistIds.filter((d) => d !== id) : [...current.dentistIds, id],
    }));
  }
  function toggleStatus(status: CalendarAppointmentStatus) {
    setFilters((current) => ({
      ...current,
      statuses: current.statuses.includes(status) ? current.statuses.filter((s) => s !== status) : [...current.statuses, status],
    }));
  }

  function openNewAppointment(startAt?: Date, dentistId?: string | null) {
    setNewAppointmentDefaults({ startAt, dentistId: dentistId ?? undefined });
    setNewAppointmentOpen(true);
  }

  function handleDayClick(date: Date) {
    setAnchor(date);
    setView("day");
  }

  async function handleReschedule(appointmentId: string, newStart: Date, newEnd: Date) {
    if (!data) return;
    const previous = data.appointments;
    const target = previous.find((a) => a.id === appointmentId);
    if (!target) return;

    setData({
      ...data,
      appointments: previous.map((a) =>
        a.id === appointmentId ? { ...a, startAt: newStart.toISOString(), endAt: newEnd.toISOString() } : a,
      ),
    });
    setPendingIds((current) => new Set(current).add(appointmentId));

    const result = await rescheduleAppointmentAction({
      clinicId,
      appointmentId,
      newStartAtIso: newStart.toISOString(),
      newEndAtIso: newEnd.toISOString(),
    });

    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(appointmentId);
      return next;
    });

    if (!result.ok) {
      setData((current) =>
        current ? { ...current, appointments: current.appointments.map((a) => (a.id === appointmentId ? target : a)) } : current,
      );
      pushToast(result.message, "error");
      return;
    }

    pushToast(interpolate(t.calendar.toast.moved, { patient: target.patientName, time: formatTime(newStart.toISOString(), locale) }), "success");
    load();
  }

  const rangeLabel =
    view === "day"
      ? formatFullDate(anchor, locale)
      : view === "month"
        ? formatMonthYear(anchor, locale)
        : `${formatDayMonth(from, locale)} – ${formatDayMonth(addDays(to, -1), locale)}`;

  const isEmptyRange = data !== null && view !== "month" && filteredAppointments.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <CalendarToolbar
        view={view}
        onViewChange={setView}
        rangeLabel={rangeLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        search={filters.search}
        onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}
        dentists={data?.dentists ?? []}
        selectedDentistIds={filters.dentistIds}
        onToggleDentist={toggleDentist}
        selectedStatuses={filters.statuses}
        onToggleStatus={toggleStatus}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        onNewAppointment={() => openNewAppointment()}
        t={t}
      />

      {!data && !error ? (
        <CalendarSkeleton />
      ) : error && !data ? (
        <EmptyState
          icon={AlertTriangle}
          title={t.calendar.loadError}
          action={
            <Button size="sm" variant="outline" onClick={() => load()}>
              {t.calendar.retry}
            </Button>
          }
        />
      ) : (
        <>
          {isEmptyRange && (
            <EmptyState icon={CalendarX} title={t.calendar.empty} description={t.calendar.emptyDescription} />
          )}
          {!isEmptyRange && view === "day" && data && (
            <DayView
              date={anchor}
              dentists={data.dentists}
              appointments={filteredAppointments}
              workingHours={data.workingHours}
              timeOff={data.timeOff}
              t={t}
              locale={locale}
              pendingIds={pendingIds}
              onSlotClick={openNewAppointment}
              onAppointmentOpen={setSelectedAppointment}
              onReschedule={handleReschedule}
            />
          )}
          {!isEmptyRange && view === "week" && data && (
            <WeekView
              date={anchor}
              appointments={filteredAppointments}
              workingHours={data.workingHours}
              timeOff={data.timeOff}
              t={t}
              locale={locale}
              pendingIds={pendingIds}
              onSlotClick={openNewAppointment}
              onAppointmentOpen={setSelectedAppointment}
              onReschedule={handleReschedule}
            />
          )}
          {view === "month" && data && (
            <MonthView
              date={anchor}
              appointments={filteredAppointments}
              t={t}
              locale={locale}
              onDayClick={handleDayClick}
              onAppointmentOpen={setSelectedAppointment}
            />
          )}
        </>
      )}

      {data && (
        <NewAppointmentDialog
          clinicId={clinicId}
          patients={data.patients.map((p) => ({ id: p.id, full_name: p.fullName }))}
          dentists={data.dentists.filter((d) => d.isActive).map((d) => ({ id: d.id, full_name: d.fullName }))}
          services={data.services}
          open={newAppointmentOpen}
          onOpenChange={(nextOpen) => {
            setNewAppointmentOpen(nextOpen);
            if (!nextOpen) load();
          }}
          hideTrigger
          defaultStartAt={newAppointmentDefaults.startAt}
          defaultDentistId={newAppointmentDefaults.dentistId}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailDialog
          clinicId={clinicId}
          appointment={selectedAppointment}
          t={t}
          locale={locale}
          onOpenChange={(open) => {
            if (!open) setSelectedAppointment(null);
          }}
          onUpdated={() => load()}
        />
      )}

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-lg px-3 py-2 text-sm shadow-lg",
              toast.variant === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
