"use client";

import { useActionState } from "react";
import { updateAppointmentStatus, type UpdateStatusFormState } from "@/app/actions/appointments";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const STATUS_OPTIONS = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

const selectClass =
  "h-7 min-w-0 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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
  const t = useTranslations();

  return (
    <form action={action} className="flex items-center gap-1.5">
      <select key={status} name="status" defaultValue={status} className={selectClass} disabled={pending}>
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t.appointmentStatus[option]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost" size="xs" disabled={pending}>
        {pending ? "..." : t.common.save}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
