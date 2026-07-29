import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";

type NotificationRow = {
  id: string;
  type: string;
  channel: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
};

const NOTIFICATION_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sent: "default",
  failed: "destructive",
  skipped: "outline",
};

export function NotificationsSection({ notifications, t, locale }: { notifications: NotificationRow[]; t: Dictionary; locale: Locale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.notifications.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.patientDetail.notifications.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t.patientDetail.notifications.type[n.type as keyof typeof t.patientDetail.notifications.type] ?? n.type} ·{" "}
                  {t.channel[n.channel as keyof typeof t.channel] ?? n.channel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {n.status === "sent" && n.sent_at
                    ? interpolate(t.patientDetail.notifications.sentAt, { time: formatDateTime(n.sent_at, locale) })
                    : interpolate(t.patientDetail.notifications.scheduledFor, { time: formatDateTime(n.scheduled_for, locale) })}
                </span>
                <Badge variant={NOTIFICATION_STATUS_VARIANT[n.status] ?? "secondary"}>
                  {t.patientDetail.notifications.status[n.status as keyof typeof t.patientDetail.notifications.status] ?? n.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
