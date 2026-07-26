import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export type TimelineEntry = {
  id: string;
  date: string;
  kind: "appointment" | "note" | "treatment";
  title: string;
  description?: string;
};

const KIND_LABEL: Record<TimelineEntry["kind"], string> = {
  appointment: "Appointment",
  note: "Note",
  treatment: "Treatment",
};

const KIND_VARIANT: Record<TimelineEntry["kind"], "default" | "secondary" | "outline"> = {
  appointment: "secondary",
  note: "outline",
  treatment: "default",
};

export function PatientTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <Badge variant={KIND_VARIANT[entry.kind]} className="mt-0.5 h-fit shrink-0">
                  {KIND_LABEL[entry.kind]}
                </Badge>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.date)}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="mt-0.5 text-muted-foreground">{entry.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
