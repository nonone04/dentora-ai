"use client";

import { useActionState, useState } from "react";
import {
  updateNotificationSettings,
  type UpdateNotificationSettingsFormState,
} from "@/app/actions/clinics";
import { DEFAULT_REMINDER_HOURS_BEFORE, DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE } from "@/lib/notifications/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: UpdateNotificationSettingsFormState = undefined;

export function NotificationSettingsForm({
  clinicId,
  reminderHoursBefore,
  secondaryReminderHoursBefore,
  sendConfirmations,
  googleReviewUrl,
  channelEmail,
  channelInApp,
  categoryAppointmentReminders,
  categorySecurityAlerts,
  categoryAiSummaries,
  categoryTeamActivity,
}: {
  clinicId: string;
  reminderHoursBefore: number;
  secondaryReminderHoursBefore: number | null;
  sendConfirmations: boolean;
  googleReviewUrl: string | null;
  channelEmail: boolean;
  channelInApp: boolean;
  categoryAppointmentReminders: boolean;
  categorySecurityAlerts: boolean;
  categoryAiSummaries: boolean;
  categoryTeamActivity: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateNotificationSettings.bind(null, clinicId),
    initialState,
  );
  const t = useTranslations();
  const [secondaryReminderEnabled, setSecondaryReminderEnabled] = useState(secondaryReminderHoursBefore !== null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t.settings.notifications.reminderHoursLabel}</label>
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
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="secondaryReminderEnabled"
              checked={secondaryReminderEnabled}
              onChange={(e) => setSecondaryReminderEnabled(e.target.checked)}
              className="size-4 rounded border-input"
            />
            {t.settings.notifications.secondaryReminderLabel}
          </label>
          {secondaryReminderEnabled && (
            <div className="flex flex-col gap-1 ps-6">
              <label className="text-xs text-muted-foreground">{t.settings.notifications.secondaryReminderHoursLabel}</label>
              <Input
                type="number"
                name="secondaryReminderHoursBefore"
                min={0}
                step={1}
                defaultValue={secondaryReminderHoursBefore ?? DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE}
                className="w-32"
                required
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="sendConfirmations"
            defaultChecked={sendConfirmations}
            className="size-4 rounded border-input"
          />
          {t.settings.notifications.sendConfirmations}
        </label>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t.settings.notifications.googleReviewUrlLabel}</label>
          <Input type="url" name="googleReviewUrl" defaultValue={googleReviewUrl ?? ""} dir="ltr" placeholder="https://g.page/r/..." />
          <p className="text-xs text-muted-foreground">{t.settings.notifications.googleReviewUrlHelp}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t.settings.notifications.channels.title}</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="channelEmail" defaultChecked={channelEmail} className="size-4 rounded border-input" />
          {t.settings.notifications.channels.email}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="channelInApp" defaultChecked={channelInApp} className="size-4 rounded border-input" />
          {t.settings.notifications.channels.inApp}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t.settings.notifications.categories.title}</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="categoryAppointmentReminders"
            defaultChecked={categoryAppointmentReminders}
            className="size-4 rounded border-input"
          />
          {t.settings.notifications.categories.appointmentReminders}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="categoryAiSummaries"
            defaultChecked={categoryAiSummaries}
            className="size-4 rounded border-input"
          />
          {t.settings.notifications.categories.aiSummaries}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            name="categorySecurityAlerts"
            defaultChecked={categorySecurityAlerts}
            className="size-4 rounded border-input"
          />
          {t.settings.notifications.categories.securityAlerts}
          <span className="text-xs">({t.settings.notifications.categories.comingSoon})</span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            name="categoryTeamActivity"
            defaultChecked={categoryTeamActivity}
            className="size-4 rounded border-input"
          />
          {t.settings.notifications.categories.teamActivity}
          <span className="text-xs">({t.settings.notifications.categories.comingSoon})</span>
        </label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">{t.common.saved}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
