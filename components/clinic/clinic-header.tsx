"use client";

import { Menu, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/clinic/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/lib/i18n";
import type { NotificationCenterItem } from "@/lib/notifications/queries";
import type { ClinicRole } from "@/lib/supabase/clinic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ClinicHeader({
  clinicId,
  clinicName,
  role,
  userDisplayName,
  onMenuClick,
  notifications = [],
  unreadNotificationCount = 0,
}: {
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  userDisplayName: string;
  onMenuClick?: () => void;
  notifications?: NotificationCenterItem[];
  unreadNotificationCount?: number;
}) {
  const t = useTranslations();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-ms-1 lg:hidden"
          onClick={onMenuClick}
          aria-label={t.header.toggleMenu}
        >
          <Menu />
        </Button>
        <span className="truncate font-medium">{clinicName}</span>
        <Badge variant="secondary" className="shrink-0 capitalize">
          {role}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationBell clinicId={clinicId} items={notifications} unreadCount={unreadNotificationCount} />
        <ThemeToggle />
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="hidden items-center gap-2 sm:flex" />}
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(userDisplayName)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{userDisplayName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem render={<Link href="/account/security" />}>
              <ShieldIcon aria-hidden="true" />
              {t.header.accountSecurity}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut} className="contents">
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>{t.header.signOut}</DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
        <form action={signOut} className="sm:hidden">
          <Button type="submit" variant="outline" size="sm">
            {t.header.signOut}
          </Button>
        </form>
      </div>
    </header>
  );
}
