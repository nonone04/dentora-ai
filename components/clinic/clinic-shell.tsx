"use client";

import { useState } from "react";
import { ClinicHeader } from "@/components/clinic/clinic-header";
import { ClinicSidebar } from "@/components/clinic/clinic-sidebar";
import { DemoBanner } from "@/components/clinic/demo-banner";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { ProductTour } from "@/components/onboarding/product-tour";
import type { NotificationCenterItem } from "@/lib/notifications/queries";
import type { ClinicRole } from "@/lib/supabase/clinic";

export function ClinicShell({
  clinicId,
  clinicName,
  role,
  userDisplayName,
  isDemo = false,
  showOnboardingTour = false,
  notifications = [],
  unreadNotificationCount = 0,
  children,
}: {
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  userDisplayName: string;
  isDemo?: boolean;
  showOnboardingTour?: boolean;
  notifications?: NotificationCenterItem[];
  unreadNotificationCount?: number;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="clinic-scope relative isolate flex flex-1 bg-background text-foreground">
      <SectionBackground intensity="clinic" />
      {showOnboardingTour && <ProductTour />}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 duration-150 animate-in fade-in lg:hidden"
        />
      )}
      <ClinicSidebar
        clinicId={clinicId}
        clinicName={clinicName}
        role={role}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {isDemo && <DemoBanner clinicId={clinicId} />}
        <ClinicHeader
          clinicId={clinicId}
          clinicName={clinicName}
          role={role}
          userDisplayName={userDisplayName}
          onMenuClick={() => setSidebarOpen((open) => !open)}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main className="relative flex-1 overflow-x-hidden p-4 sm:p-6 lg:ps-8">{children}</main>
      </div>
    </div>
  );
}
