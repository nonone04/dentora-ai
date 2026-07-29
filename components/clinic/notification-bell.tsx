"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { archiveNotification, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/categories";
import type { NotificationCenterItem } from "@/lib/notifications/queries";

type CategoryFilter = "all" | NotificationCategory;

/**
 * Header bell for the in-app Notification Center. `items`/`unreadCount`
 * come from the server layout (app/clinic/[clinicId]/layout.tsx) via
 * lib/notifications/queries.ts -- invoking any of the server actions
 * below implicitly refreshes that RSC tree (standard Next.js Server
 * Action behavior), so this component doesn't poll or refetch on its own.
 */
export function NotificationBell({
  clinicId,
  items,
  unreadCount,
}: {
  clinicId: string;
  items: NotificationCenterItem[];
  unreadCount: number;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [pending, startTransition] = useTransition();

  const eventLabels = t.dashboard.notificationCenter.events as Record<string, string>;
  const categoryLabels = t.notificationBell.categories;
  const filtered = category === "all" ? items : items.filter((item) => item.category === category);

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(clinicId, id);
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      await archiveNotification(clinicId, id);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead(clinicId);
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" className="relative" aria-label={t.notificationBell.title} />}
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-semibold">{t.notificationBell.title}</span>
          <Button type="button" variant="ghost" size="sm" disabled={pending || unreadCount === 0} onClick={handleMarkAllRead}>
            {t.notificationBell.markAllRead}
          </Button>
        </div>

        <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)} className="p-2">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="all">{categoryLabels.all}</TabsTrigger>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c}>
                {categoryLabels[c]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <EmptyState icon={Bell} title={t.notificationBell.empty} />
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((item) => {
                const isUnread = item.status === "sent" || item.status === "delivered";
                return (
                  <li key={item.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />}
                        <span className="truncate text-sm font-medium">
                          {(item.eventType && eventLabels[item.eventType]) || t.dashboard.notificationCenter.genericEvent}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt, locale)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isUnread && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleMarkRead(item.id)}
                        >
                          {t.notificationBell.markRead}
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => handleArchive(item.id)}>
                        {t.notificationBell.archive}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
