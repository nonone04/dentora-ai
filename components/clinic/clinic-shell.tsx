import { ClinicHeader } from "@/components/clinic/clinic-header";
import { ClinicSidebar } from "@/components/clinic/clinic-sidebar";
import type { ClinicRole } from "@/lib/supabase/clinic";

export function ClinicShell({
  clinicId,
  clinicName,
  role,
  userDisplayName,
  children,
}: {
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  userDisplayName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <ClinicSidebar clinicId={clinicId} role={role} />
      <div className="flex flex-1 flex-col">
        <ClinicHeader clinicName={clinicName} role={role} userDisplayName={userDisplayName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
