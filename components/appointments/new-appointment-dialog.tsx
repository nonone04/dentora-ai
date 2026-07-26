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
}: {
  clinicId: string;
  patients: PersonOption[];
  dentists: PersonOption[];
  services: ServiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createAppointment.bind(null, clinicId),
    initialState,
  );
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New appointment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
          <DialogDescription>Schedule a new appointment for this clinic.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label="Patient">
            <select name="patientId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Select a patient
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dentist">
            <select name="dentistId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Select a dentist
              </option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service (optional)">
            <select name="serviceId" defaultValue="" className={selectClass}>
              <option value="">No service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.defaultDurationMinutes} min)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start time">
            <Input type="datetime-local" name="startAt" required />
          </Field>
          <Field label="Duration (minutes)">
            <Input type="number" name="durationMinutes" min={5} step={5} defaultValue={30} required />
          </Field>
          <Field label="Notes (optional)">
            <Textarea name="notes" rows={3} />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
