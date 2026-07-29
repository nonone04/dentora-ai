import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listNotificationCenterItems, type NotificationCenterItem } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageCircle,
  in_app: Bell,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sending: "secondary",
  sent: "outline",
  delivered: "outline",
  read: "outline",
  failed: "destructive",
};

export function NotificationCenterSkeleton() {
  return (
    <Card className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-36" />
      </div>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). */
async function loadRecentDeliveries(clinicId: string): Promise<NotificationCenterItem[] | null> {
  try {
    const supabase = await createClient();
    return await listNotificationCenterItems(supabase, { clinicId, limit: 6 });
  } catch {
    return null;
  }
}

/** Most recent patient/staff notification deliveries -- notification_deliveries' RLS is member-level, visible to every clinic role. */
export async function NotificationCenter({ clinicId }: { clinicId: string }) {
  const [deliveries, t, locale] = await Promise.all([loadRecentDeliveries(clinicId), getServerDictionary(), getServerLocale()]);

  if (deliveries === null) {
    return (
      <Card className="h-full">
        <SectionHeader title={t.dashboard.notificationCenter.title} />
        <ErrorState title={t.dashboard.notificationCenter.error} />
      </Card>
    );
  }

  const eventLabels = t.dashboard.notificationCenter.events as Record<string, string>;

  return (
    <Card className="h-full">
      <SectionHeader title={t.dashboard.notificationCenter.title} description={t.dashboard.notificationCenter.description} />
      <CardContent>
        {deliveries.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t.dashboard.notificationCenter.empty}
            description={t.dashboard.notificationCenter.emptyDescription}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {deliveries.map((delivery) => {
              const Icon = CHANNEL_ICON[delivery.channel] ?? Bell;
              const eventType = delivery.eventType;
              return (
                <li key={delivery.id} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {(eventType && eventLabels[eventType]) || t.dashboard.notificationCenter.genericEvent}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(delivery.createdAt, locale)}</div>
                  </div>
                  <Badge variant={STATUS_VARIANT[delivery.status] ?? "secondary"} className="shrink-0">
                    {t.deliveryStatus[delivery.status as keyof typeof t.deliveryStatus] ?? delivery.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
