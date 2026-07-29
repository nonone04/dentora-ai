"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getSuggestedSlotsAction, type SuggestedSlot } from "@/app/actions/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Surfaces the Availability Engine's own candidate slots (the same
 * deterministic ranking the AI assistant offers patients -- see
 * app/actions/calendar.ts's getSuggestedSlotsAction) as quick picks
 * when creating or rescheduling an appointment. Fetches on mount/when
 * its inputs change; never blocks the surrounding form.
 */
export function SuggestedSlots({
  clinicId,
  dentistId,
  serviceId,
  fromDateIso,
  t,
  locale,
  onApply,
}: {
  clinicId: string;
  dentistId: string;
  serviceId?: string | null;
  fromDateIso: string;
  t: Dictionary;
  locale: Locale;
  onApply: (startAtIso: string, endAtIso: string) => void;
}) {
  const requestKey = `${clinicId}|${dentistId}|${serviceId ?? ""}|${fromDateIso}`;
  const [result, setResult] = useState<{ key: string; slots: SuggestedSlot[] | null }>({
    key: requestKey,
    slots: null,
  });
  if (result.key !== requestKey) {
    setResult({ key: requestKey, slots: dentistId ? null : [] });
  }
  const slots = result.key === requestKey ? result.slots : null;

  useEffect(() => {
    if (!dentistId) return;
    let cancelled = false;
    getSuggestedSlotsAction({ clinicId, dentistId, serviceId, fromDateIso }).then((slots) => {
      if (!cancelled) setResult({ key: requestKey, slots });
    });
    return () => {
      cancelled = true;
    };
  }, [clinicId, dentistId, serviceId, fromDateIso, requestKey]);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
        {t.calendar.suggestedSlots.title}
      </div>
      {slots === null ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-md" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.calendar.suggestedSlots.empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <Button
              key={`${slot.dentistId}-${slot.startAt}`}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onApply(slot.startAt, slot.endAt)}
            >
              {formatDateTime(slot.startAt, locale)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
