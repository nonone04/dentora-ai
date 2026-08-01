"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ClinicSidebar({
  clinicId,
  clinicName,
  role,
  open = false,
  onNavigate,
}: {
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  /** Whether the mobile drawer is open. Ignored at the lg+ breakpoint, where the sidebar is always visible in-flow. */
  open?: boolean;
  /** Called when a nav link is activated -- used to close the mobile drawer after navigating. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const shouldReduceMotion = useReducedMotion();
  const base = `/clinic/${clinicId}`;

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav
      className={cn(
        "fixed inset-y-0 start-0 z-50 flex w-72 shrink-0 -translate-x-full flex-col p-3 transition-transform duration-300 ease-out rtl:translate-x-full",
        "lg:static lg:z-auto lg:w-64 lg:translate-x-0 rtl:lg:translate-x-0",
        open && "translate-x-0 rtl:translate-x-0",
      )}
    >
      <div className="flex h-full flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/90 p-3.5 shadow-[0_20px_50px_-22px_rgba(15,23,42,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-foreground/[0.03] dark:shadow-[0_8px_40px_-16px_rgba(0,0,0,0.6)] dark:backdrop-blur-xl">
        <Link href={base} className="flex items-center gap-2.5 px-1.5 pt-1">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/25">
            <Stethoscope className="size-4.5" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Dentora AI</span>
        </Link>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
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
                  "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "text-blue-700 dark:text-foreground"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-foreground/[0.04] dark:hover:text-foreground",
                )}
              >
                {isActive &&
                  (shouldReduceMotion ? (
                    <span className="absolute inset-0 rounded-xl bg-blue-50 ring-1 ring-inset ring-blue-200/80 dark:bg-gradient-to-r dark:from-blue-500/15 dark:via-violet-500/10 dark:to-transparent dark:ring-blue-400/25" />
                  ) : (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-blue-50 ring-1 ring-inset ring-blue-200/80 dark:bg-gradient-to-r dark:from-blue-500/15 dark:via-violet-500/10 dark:to-transparent dark:ring-blue-400/25"
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    />
                  ))}
                {isActive && (
                  <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-blue-600 dark:bg-gradient-to-b dark:from-blue-400 dark:to-violet-400 dark:shadow-[0_0_10px_2px_rgba(96,165,250,0.55)]" />
                )}
                <Icon className="relative z-10 size-4 shrink-0" aria-hidden="true" />
                <span className="relative z-10 truncate">{item.label(t)}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-2.5 dark:border-white/10 dark:bg-foreground/[0.02]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-[11px] font-semibold uppercase text-foreground ring-1 ring-foreground/10">
            {initials(clinicName) || clinicName.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground">{clinicName}</span>
            <span className="truncate text-[11px] capitalize text-muted-foreground">{role}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
