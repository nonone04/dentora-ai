"use client";

import { useState, useTransition } from "react";
import { updateAppointmentStatus } from "@/app/actions/appointments";
import { rescheduleAppointmentAction } from "@/app/actions/calendar";
import { AppointmentWhatsAppPanel } from "@/components/calendar/appointment-whatsapp-panel";
import { SuggestedSlots } from "@/components/calendar/suggested-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { dentistColor } from "@/lib/calendar/colors";
import { toDateTimeLocalValue, toISODate } from "@/lib/calendar/date-grid";
import type { CalendarAppointment, CalendarAppointmentStatus } from "@/lib/calendar/types";
import { formatDateTime, STATUS_VARIANT } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

export function AppointmentDetailDialog({
  clinicId,
  appointment,
  t,
  locale,
  onOpenChange,
  onUpdated,
}: {
  clinicId: string;
  appointment: CalendarAppointment;
  t: Dictionary;
  locale: Locale;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [startValue, setStartValue] = useState(toDateTimeLocalValue(new Date(appointment.startAt)));
  const [durationValue, setDurationValue] = useState(
    String(Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60_000)),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  function applySuggestedSlot(startAtIso: string, endAtIso: string) {
    setStartValue(toDateTimeLocalValue(new Date(startAtIso)));
    setDurationValue(String(Math.round((new Date(endAtIso).getTime() - new Date(startAtIso).getTime()) / 60_000)));
  }

  function submitReschedule() {
    setError(null);
    const start = new Date(startValue);
    const duration = Number(durationValue);
    if (Number.isNaN(start.getTime()) || !Number.isFinite(duration) || duration <= 0) return;
    const end = new Date(start.getTime() + duration * 60_000);

    startTransition(async () => {
      const result = await rescheduleAppointmentAction({
        clinicId,
        appointmentId: appointment.id,
        newStartAtIso: start.toISOString(),
        newEndAtIso: end.toISOString(),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onUpdated();
      onOpenChange(false);
    });
  }

  function submitStatus(status: CalendarAppointmentStatus) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("status", status);
      const result = await updateAppointmentStatus(clinicId, appointment.id, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onUpdated();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dentistColor(appointment.dentistId, appointment.dentistColor) }} />
            {appointment.patientName || t.calendar.detail.title}
          </DialogTitle>
          <DialogDescription>{formatDateTime(appointment.startAt, locale)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <div className="text-xs text-muted-foreground">{t.calendar.detail.dentistLabel}</div>
              <div className="font-medium">{appointment.dentistName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t.calendar.detail.serviceLabel}</div>
              <div className="font-medium">{appointment.serviceName ?? t.common.dash}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t.calendar.detail.statusLabel}</div>
              <Badge variant={STATUS_VARIANT[appointment.status] ?? "secondary"} className="mt-0.5">
                {t.appointmentStatus[appointment.status]}
              </Badge>
            </div>
          </div>
          {appointment.notes && (
            <div>
              <div className="text-xs text-muted-foreground">{t.calendar.detail.notesLabel}</div>
              <p className="text-sm">{appointment.notes}</p>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.calendar.detail.rescheduleTitle}</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="reschedule-start" className="text-xs text-muted-foreground">
                  {t.calendar.detail.startLabel}
                </label>
                <Input
                  id="reschedule-start"
                  type="datetime-local"
                  value={startValue}
                  onChange={(event) => setStartValue(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="reschedule-duration" className="text-xs text-muted-foreground">
                  {t.calendar.detail.durationLabel}
                </label>
                <Input
                  id="reschedule-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={durationValue}
                  onChange={(event) => setDurationValue(event.target.value)}
                />
              </div>
            </div>
            <SuggestedSlots
              clinicId={clinicId}
              dentistId={appointment.dentistId}
              serviceId={appointment.serviceId}
              fromDateIso={toISODate(Number.isNaN(new Date(startValue).getTime()) ? new Date(appointment.startAt) : new Date(startValue))}
              t={t}
              locale={locale}
              onApply={applySuggestedSlot}
            />
            <Button size="sm" className="self-start" disabled={pending} onClick={submitReschedule}>
              {pending ? t.common.saving : t.calendar.detail.saveChanges}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Separator />

          <AppointmentWhatsAppPanel clinicId={clinicId} appointmentId={appointment.id} t={t} locale={locale} />
        </div>

        <DialogFooter className="flex-wrap gap-1.5">
          {confirmingCancel ? (
            <>
              <span className="me-auto self-center text-sm text-muted-foreground">{t.calendar.detail.cancelConfirm}</span>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirmingCancel(false)}>
                {t.calendar.detail.keepAppointment}
              </Button>
              <Button variant="destructive" size="sm" disabled={pending} onClick={() => submitStatus("cancelled")}>
                {t.calendar.detail.cancelAppointment}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirmingCancel(true)}>
                {t.calendar.detail.cancelAppointment}
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => submitStatus("no_show")}>
                {t.calendar.detail.markNoShow}
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => submitStatus("completed")}>
                {t.calendar.detail.completeAppointment}
              </Button>
              <Button size="sm" disabled={pending} onClick={() => submitStatus("confirmed")}>
                {t.calendar.detail.confirmAppointment}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
