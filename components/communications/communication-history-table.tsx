import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { CommunicationHistoryItem } from "@/lib/notifications/queries";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sending: "secondary",
  sent: "default",
  delivered: "default",
  read: "default",
  failed: "destructive",
};

export function CommunicationHistoryTable({ items, t, locale }: { items: CommunicationHistoryItem[]; t: Dictionary; locale: Locale }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.communications.empty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.communications.columns.time}</TableHead>
          <TableHead>{t.communications.columns.patient}</TableHead>
          <TableHead>{t.communications.columns.type}</TableHead>
          <TableHead>{t.communications.columns.channel}</TableHead>
          <TableHead>{t.communications.columns.status}</TableHead>
          <TableHead>{t.communications.columns.response}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{formatDateTime(item.createdAt, locale)}</TableCell>
            <TableCell>{item.patientName ?? t.common.dash}</TableCell>
            <TableCell>
              {(item.eventType && t.patientDetail.notifications.type[item.eventType as keyof typeof t.patientDetail.notifications.type]) ??
                item.eventType ??
                t.common.dash}
            </TableCell>
            <TableCell>{t.channel[item.channel as keyof typeof t.channel] ?? item.channel}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                {t.patientDetail.notifications.status[item.status as keyof typeof t.patientDetail.notifications.status] ?? item.status}
              </Badge>
            </TableCell>
            <TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={item.response?.value}>
              {item.response
                ? item.response.kind === "timestamp"
                  ? formatDateTime(item.response.value, locale)
                  : item.response.value
                : t.common.dash}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
