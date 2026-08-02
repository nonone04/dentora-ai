import { redirect } from "next/navigation";
import { ClinicShell } from "@/components/clinic/clinic-shell";
import { countUnreadNotifications, listNotificationCenterItems } from "@/lib/notifications/queries";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { clinicHasActiveSubscription } from "@/lib/supabase/subscription";
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

  // getClaims() (used by proxy.ts) doesn't carry email_confirmed_at, so this
  // is enforced here, where getUser() already runs -- not in the proxy.
  if (!user.email_confirmed_at) {
    redirect(`/verify-email?email=${encodeURIComponent(user.email ?? "")}&redirectTo=${encodeURIComponent(`/clinic/${clinicId}`)}`);
  }

  const membership = await requireClinicMembership(clinicId, user.id);

  const supabase = await createClient();

  // Every clinic route lives under this layout, so this is the single
  // choke point for "no active subscription -> no dashboard access"
  // (invited staff inherit the clinic owner's status, see the
  // clinic_has_active_subscription SQL function). Checked before the
  // data-fetching below so a lapsed subscription short-circuits early.
  if (!(await clinicHasActiveSubscription(supabase, clinicId))) {
    redirect("/pricing");
  }

  const [{ data: profile }, { data: clinic }, notifications, unreadNotificationCount] = await Promise.all([
    supabase.from("profiles").select("full_name, onboarding_tour_completed_at").eq("id", user.id).maybeSingle(),
    supabase.from("clinics").select("is_demo").eq("id", clinicId).maybeSingle(),
    listNotificationCenterItems(supabase, { clinicId, channel: "in_app", limit: 30 }),
    countUnreadNotifications(supabase, clinicId),
  ]);

  const userDisplayName = profile?.full_name || user.email || "Account";

  return (
    <ClinicShell
      clinicId={membership.clinicId}
      clinicName={membership.clinicName}
      role={membership.role}
      userDisplayName={userDisplayName}
      isDemo={clinic?.is_demo ?? false}
      showOnboardingTour={!profile?.onboarding_tour_completed_at}
      notifications={notifications ?? []}
      unreadNotificationCount={unreadNotificationCount ?? 0}
    >
      {children}
    </ClinicShell>
  );
}
