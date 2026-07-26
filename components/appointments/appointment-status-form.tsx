"use client";

import { useActionState } from "react";
import { updateAppointmentStatus, type UpdateStatusFormState } from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

const selectClass =
  "h-7 min-w-0 rounded-lg border border-input bg-transparent px-2 text-xs capitalize outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const initialState: UpdateStatusFormState = undefined;

export function AppointmentStatusForm({
  clinicId,
  appointmentId,
  status,
}: {
  clinicId: string;
  appointmentId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    updateAppointmentStatus.bind(null, clinicId, appointmentId),
    initialState,
  );

  return (
    <form action={action} className="flex items-center gap-1.5">
      <select key={status} name="status" defaultValue={status} className={selectClass} disabled={pending}>
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option.replace("_", " ")}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost" size="xs" disabled={pending}>
        {pending ? "..." : "Save"}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
