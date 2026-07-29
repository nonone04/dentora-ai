"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createAppointment, type CreateAppointmentFormState } from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toDateTimeLocalValue } from "@/lib/calendar/date-grid";
import { useTranslations } from "@/lib/i18n";

type PersonOption = { id: string; full_name: string };
type ServiceOption = { id: string; name: string; defaultDurationMinutes: number };

const initialState: CreateAppointmentFormState = undefined;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function NewAppointmentDialog({
  clinicId,
  patients,
  dentists,
  services,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger,
  defaultStartAt,
  defaultDentistId,
  defaultPatientId,
}: {
  clinicId: string;
  patients: PersonOption[];
  dentists: PersonOption[];
  services: ServiceOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  defaultStartAt?: Date;
  defaultDentistId?: string;
  defaultPatientId?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const [state, action, pending] = useActionState(
    createAppointment.bind(null, clinicId),
    initialState,
  );
  const [handledState, setHandledState] = useState(state);
  const t = useTranslations();

  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger render={<Button />}>{t.dashboard.quickActions.newAppointment}</DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.appointments.dialog.newTitle}</DialogTitle>
          <DialogDescription>{t.appointments.dialog.newDescription}</DialogDescription>
        </DialogHeader>
        <form
          key={`${defaultPatientId ?? ""}-${defaultDentistId ?? ""}-${defaultStartAt ? defaultStartAt.getTime() : ""}`}
          action={action}
          className="flex flex-col gap-3"
        >
          <Field label={t.appointments.dialog.patientLabel}>
            <select name="patientId" required defaultValue={defaultPatientId ?? ""} className={selectClass}>
              <option value="" disabled>
                {t.appointments.dialog.selectPatient}
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.appointments.dialog.dentistLabel}>
            <select name="dentistId" required defaultValue={defaultDentistId ?? ""} className={selectClass}>
              <option value="" disabled>
                {t.appointments.dialog.selectDentist}
              </option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t.appointments.dialog.serviceLabel} (${t.common.optional})`}>
            <select name="serviceId" defaultValue="" className={selectClass}>
              <option value="">{t.appointments.dialog.noService}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.defaultDurationMinutes} {t.appointments.dialog.minutesSuffix})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.appointments.dialog.startTimeLabel}>
            <Input
              type="datetime-local"
              name="startAt"
              required
              defaultValue={defaultStartAt ? toDateTimeLocalValue(defaultStartAt) : undefined}
            />
          </Field>
          <Field label={t.appointments.dialog.durationLabel}>
            <Input type="number" name="durationMinutes" min={5} step={5} defaultValue={30} required />
          </Field>
          <Field label={`${t.appointments.dialog.notesLabel} (${t.common.optional})`}>
            <Textarea name="notes" rows={3} />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.creating : t.appointments.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
