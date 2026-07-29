"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  ScanSearch,
  Settings,
  Stethoscope,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClinicRole } from "@/lib/supabase/clinic";
import type { Dictionary } from "@/lib/i18n";

type NavItem = {
  label: (t: Dictionary) => string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ClinicRole[];
  tourId?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: (t) => t.nav.overview, href: "", icon: LayoutDashboard, tourId: "overview" },
  { label: (t) => t.nav.calendar, href: "/calendar", icon: CalendarClock, tourId: "calendar" },
  { label: (t) => t.nav.appointments, href: "/appointments", icon: CalendarDays },
  { label: (t) => t.nav.aiInbox, href: "/ai-inbox", icon: Inbox, tourId: "ai-inbox" },
  { label: (t) => t.nav.aiInspector, href: "/ai-inspector", icon: ScanSearch, roles: ["owner", "admin"] },
  { label: (t) => t.nav.patients, href: "/patients", icon: Users, tourId: "patients" },
  { label: (t) => t.nav.dentists, href: "/dentists", icon: Stethoscope },
  { label: (t) => t.nav.services, href: "/services", icon: Wrench },
  { label: (t) => t.nav.knowledgeBase, href: "/knowledge-base", icon: BookOpen },
  { label: (t) => t.nav.staff, href: "/staff", icon: UsersRound, roles: ["owner", "admin"], tourId: "staff" },
  { label: (t) => t.nav.settings, href: "/settings", icon: Settings, roles: ["owner", "admin"], tourId: "settings" },
];

export function ClinicSidebar({
  clinicId,
  role,
  open = false,
  onNavigate,
}: {
  clinicId: string;
  role: ClinicRole;
  /** Whether the mobile drawer is open. Ignored at the lg+ breakpoint, where the sidebar is always visible in-flow. */
  open?: boolean;
  /** Called when a nav link is activated -- used to close the mobile drawer after navigating. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const base = `/clinic/${clinicId}`;

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav
      className={cn(
        "fixed inset-y-0 start-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col gap-1 border-e border-border bg-sidebar p-3 transition-transform duration-200 ease-out rtl:translate-x-full",
        "lg:static lg:z-auto lg:w-56 lg:translate-x-0 lg:bg-transparent rtl:lg:translate-x-0",
        open && "translate-x-0 rtl:translate-x-0",
      )}
    >
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const isActive = pathname === href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            data-tour={item.tourId}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label(t)}
          </Link>
        );
      })}
    </nav>
  );
}
