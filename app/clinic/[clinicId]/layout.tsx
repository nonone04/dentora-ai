import { ClinicShell } from "@/components/clinic/clinic-shell";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export default async function ClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userDisplayName = profile?.full_name || user.email || "Account";

  return (
    <ClinicShell
      clinicId={membership.clinicId}
      clinicName={membership.clinicName}
      role={membership.role}
      userDisplayName={userDisplayName}
    >
      {children}
    </ClinicShell>
  );
}
