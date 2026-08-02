"use client";

import { ChevronDown, CreditCard, Menu, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/clinic/notification-bell";
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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-foreground/8 bg-foreground/[0.03] px-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_12px_32px_-20px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-6 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_50px_-28px_rgba(0,0,0,0.7)]">
      <div className="flex min-w-0 items-center gap-2.5">
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
        <span className="truncate text-sm font-medium text-foreground">{clinicName}</span>
        <Badge variant="outline" className="shrink-0 gap-1 border-foreground/15 bg-foreground/5 capitalize text-muted-foreground">
          {role}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationBell clinicId={clinicId} items={notifications} unreadCount={unreadNotificationCount} />
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="hidden h-auto items-center gap-2 rounded-full border border-foreground/8 bg-foreground/[0.03] py-1 pe-2 ps-1.5 transition-colors hover:border-foreground/15 hover:bg-foreground/[0.06] sm:flex"
              />
            }
          >
            <Avatar size="sm" className="ring-1 ring-foreground/10">
              <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-violet-500/30 text-foreground">
                {initials(userDisplayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{userDisplayName}</span>
            <Badge
              variant="outline"
              className="hidden shrink-0 border-foreground/15 bg-foreground/5 capitalize text-muted-foreground md:inline-flex"
            >
              {role}
            </Badge>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem render={<Link href="/account/security" />}>
              <ShieldIcon aria-hidden="true" />
              {t.header.accountSecurity}
            </DropdownMenuItem>
            {role === "owner" && (
              <DropdownMenuItem render={<Link href="/account/billing" />}>
                <CreditCard aria-hidden="true" />
                {t.header.accountBilling}
              </DropdownMenuItem>
            )}
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
