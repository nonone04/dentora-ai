"use client";

import { useActionState } from "react";
import { addTimeOff, deleteTimeOff, type ActionFormState } from "@/app/actions/dentists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";

type TimeOff = { id: string; start_at: string; end_at: string; reason: string | null };

const initialState: ActionFormState = undefined;

export function TimeOffManager({
  clinicId,
  dentistId,
  timeOff,
  canManage,
}: {
  clinicId: string;
  dentistId: string;
  timeOff: TimeOff[];
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    addTimeOff.bind(null, clinicId, dentistId),
    initialState,
  );
  const deleteAction = deleteTimeOff.bind(null, clinicId, dentistId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time off</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {timeOff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time off scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {timeOff.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span>
                  {formatDateTime(entry.start_at)} – {formatDateTime(entry.end_at)}
                  {entry.reason ? ` (${entry.reason})` : ""}
                </span>
                {canManage && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={entry.id} />
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
              <label className="text-sm font-medium">Start</label>
              <Input type="datetime-local" name="startAt" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">End</label>
              <Input type="datetime-local" name="endAt" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input name="reason" />
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
