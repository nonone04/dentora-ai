import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import type { PatientNotificationDeliveryItem } from "@/lib/notifications/queries";

const NOTIFICATION_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sending: "secondary",
  sent: "default",
  delivered: "default",
  read: "default",
  failed: "destructive",
};

export function NotificationsSection({
  notifications,
  t,
  locale,
}: {
  notifications: PatientNotificationDeliveryItem[];
  t: Dictionary;
  locale: Locale;
}) {
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
                  {(n.eventType && t.patientDetail.notifications.type[n.eventType as keyof typeof t.patientDetail.notifications.type]) ??
                    n.eventType ??
                    t.common.dash}{" "}
                  · {t.channel[n.channel as keyof typeof t.channel] ?? n.channel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {n.status === "sent" || n.status === "delivered" || n.status === "read"
                    ? n.sentAt
                      ? interpolate(t.patientDetail.notifications.sentAt, { time: formatDateTime(n.sentAt, locale) })
                      : null
                    : interpolate(t.patientDetail.notifications.scheduledFor, { time: formatDateTime(n.scheduledFor, locale) })}
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
