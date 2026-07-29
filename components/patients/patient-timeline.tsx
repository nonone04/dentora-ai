import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

export type TimelineEntry = {
  id: string;
  date: string;
  kind: "appointment" | "note" | "treatment" | "conversation";
  title: string;
  description?: string;
};

const KIND_VARIANT: Record<TimelineEntry["kind"], "default" | "secondary" | "outline"> = {
  appointment: "secondary",
  note: "outline",
  treatment: "default",
  conversation: "outline",
};

export function PatientTimeline({ entries, t, locale }: { entries: TimelineEntry[]; t: Dictionary; locale: Locale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.timeline.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState icon={History} title={t.patientDetail.timeline.empty} description={t.patientDetail.timeline.emptyDescription} />
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <Badge variant={KIND_VARIANT[entry.kind]} className="mt-0.5 h-fit shrink-0">
                  {t.patientDetail.timeline.kind[entry.kind]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{entry.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.date, locale)}</span>
                  </div>
                  {entry.description && <p className="mt-0.5 text-muted-foreground">{entry.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
