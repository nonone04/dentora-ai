"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getAppointmentWhatsAppStatusAction,
  sendConfirmationAction,
  sendCustomMessageAction,
  sendReminderAction,
  sendReviewRequestAction,
} from "@/app/actions/whatsapp-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { AppointmentWhatsAppStatus } from "@/lib/notifications/queries";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sending: "secondary",
  sent: "default",
  delivered: "default",
  read: "default",
  failed: "destructive",
};

export function AppointmentWhatsAppPanel({
  clinicId,
  appointmentId,
  t,
  locale,
}: {
  clinicId: string;
  appointmentId: string;
  t: Dictionary;
  locale: Locale;
}) {
  const wt = t.calendar.detail.whatsapp;
  const [status, setStatus] = useState<AppointmentWhatsAppStatus | null | undefined>(undefined);
  const [customMessage, setCustomMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshStatus() {
    getAppointmentWhatsAppStatusAction(clinicId, appointmentId).then(setStatus);
  }

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  function runAction(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      refreshStatus();
    });
  }

  function submitCustomMessage() {
    const body = customMessage.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await sendCustomMessageAction(clinicId, appointmentId, body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCustomMessage("");
      refreshStatus();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{wt.title}</span>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runAction(() => sendReminderAction(clinicId, appointmentId))}>
          {wt.sendReminder}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => runAction(() => sendConfirmationAction(clinicId, appointmentId))}
        >
          {wt.sendConfirmation}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => runAction(() => sendReviewRequestAction(clinicId, appointmentId))}
        >
          {wt.sendReviewRequest}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder={wt.customMessagePlaceholder}
          rows={2}
          className="text-sm"
        />
        <Button type="button" size="sm" className="self-start" disabled={pending || !customMessage.trim()} onClick={submitCustomMessage}>
          {pending ? wt.sending : `${wt.sendCustomMessage} · ${wt.send}`}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Separator />

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{wt.lastMessage}</span>
        {status === undefined ? null : status === null ? (
          <p className="text-sm text-muted-foreground">{wt.noMessages}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {(status.eventType && t.patientDetail.notifications.type[status.eventType as keyof typeof t.patientDetail.notifications.type]) ??
                status.eventType ??
                t.common.dash}
            </span>
            <Badge variant={STATUS_VARIANT[status.status] ?? "secondary"}>{wt.status[status.status as keyof typeof wt.status] ?? status.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(status.readAt ?? status.deliveredAt ?? status.sentAt ?? status.scheduledFor, locale)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
