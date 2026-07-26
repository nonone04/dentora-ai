import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

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

export function NotificationsSection({ notifications }: { notifications: NotificationRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2">
                <span className="capitalize">
                  {n.type} · {n.channel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {n.status === "sent" && n.sent_at
                    ? `Sent ${formatDateTime(n.sent_at)}`
                    : `Scheduled ${formatDateTime(n.scheduled_for)}`}
                </span>
                <Badge variant={NOTIFICATION_STATUS_VARIANT[n.status] ?? "secondary"} className="capitalize">
                  {n.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
