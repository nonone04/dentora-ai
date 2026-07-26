"use client";

import { useActionState } from "react";
import {
  updateNotificationSettings,
  type UpdateNotificationSettingsFormState,
} from "@/app/actions/clinics";
import { DEFAULT_REMINDER_HOURS_BEFORE } from "@/lib/notifications/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: UpdateNotificationSettingsFormState = undefined;

export function NotificationSettingsForm({
  clinicId,
  reminderHoursBefore,
  sendConfirmations,
}: {
  clinicId: string;
  reminderHoursBefore: number;
  sendConfirmations: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateNotificationSettings.bind(null, clinicId),
    initialState,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Reminder hours before appointment</label>
        <Input
          type="number"
          name="reminderHoursBefore"
          min={0}
          step={1}
          defaultValue={reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE}
          className="w-32"
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="sendConfirmations"
          defaultChecked={sendConfirmations}
          className="size-4 rounded border-input"
        />
        Send confirmation notifications
      </label>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
