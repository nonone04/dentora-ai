"use client";

import { useActionState } from "react";
import { addWorkingHours, deleteWorkingHours, type ActionFormState } from "@/app/actions/dentists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DAY_LABELS } from "@/lib/format";

type WorkingHour = { id: string; day_of_week: number; start_time: string; end_time: string };

const initialState: ActionFormState = undefined;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function WorkingHoursManager({
  clinicId,
  dentistId,
  workingHours,
  canManage,
}: {
  clinicId: string;
  dentistId: string;
  workingHours: WorkingHour[];
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    addWorkingHours.bind(null, clinicId, dentistId),
    initialState,
  );
  const deleteAction = deleteWorkingHours.bind(null, clinicId, dentistId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working hours</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {workingHours.length === 0 ? (
          <p className="text-sm text-muted-foreground">No working hours set.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {workingHours.map((wh) => (
              <li key={wh.id} className="flex items-center justify-between gap-2">
                <span>
                  {DAY_LABELS[wh.day_of_week]}: {wh.start_time.slice(0, 5)}–{wh.end_time.slice(0, 5)}
                </span>
                {canManage && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={wh.id} />
                    <Button type="submit" variant="ghost" size="xs">
                      Remove
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <form action={action} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Day</label>
              <select name="dayOfWeek" defaultValue="1" className={selectClass}>
                {DAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Start</label>
              <Input type="time" name="startTime" required className="w-28" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">End</label>
              <Input type="time" name="endTime" required className="w-28" />
            </div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Adding..." : "Add"}
            </Button>
          </form>
        )}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
