"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicRole } from "@/lib/supabase/clinic";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ClinicRole[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "AI inbox", href: "/ai-inbox", icon: Inbox },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Dentists", href: "/dentists", icon: Stethoscope },
  { label: "Services", href: "/services", icon: Wrench },
  { label: "Knowledge base", href: "/knowledge-base", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["owner", "admin"] },
];

export function ClinicSidebar({ clinicId, role }: { clinicId: string; role: ClinicRole }) {
  const pathname = usePathname();
  const base = `/clinic/${clinicId}`;

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border p-3">
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const isActive = pathname === href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
