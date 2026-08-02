import { redirect } from "next/navigation";
import { CreateClinicScreen } from "@/components/onboarding/create-clinic-screen";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingHomeContent } from "@/components/marketing/home-content";
import { getServerDictionary } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/supabase/subscription";
import { getPlanPricing } from "@/lib/marketing/pricing-plans";

type PendingInvitation = {
  membership_id: string;
  clinic_id: string;
  clinic_name: string;
  role: string;
  invited_at: string;
};

export default async function Home() {
  const user = await getUser();

  if (!user) {
    const planPricing = await getPlanPricing();
    return (
      <>
        <MarketingHeader navState={{ authenticated: false }} />
        <MarketingHomeContent planPricing={planPricing} />
        <MarketingFooter navState={{ authenticated: false }} />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: membership }, t] = await Promise.all([
    supabase.from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
    getServerDictionary(),
  ]);

  if (membership) {
    redirect(`/clinic/${membership.clinic_id}`);
  }

  const [{ data: pendingData }, subscriptionActive] = await Promise.all([
    supabase.rpc("get_pending_invitations"),
    hasActiveSubscription(supabase, user.id),
  ]);
  const pendingInvitations = (pendingData ?? []) as PendingInvitation[];

  // Invited staff never pay for themselves -- if there's a pending
  // invitation, let them see/accept it regardless of their own
  // subscription status. Otherwise, a logged-in user with no clinic and no
  // subscription just sees the same Landing page a visitor would (with nav
  // adapted for being signed in) -- Pricing is only forced right after
  // login (see resolvePostAuthDestination) or when they try to open a
  // protected clinic route, never just from browsing "/".
  // (create_clinic_with_owner also enforces the subscription requirement
  // server-side, so that one-time login redirect is UX, not the
  // authoritative gate.)
  if (pendingInvitations.length === 0 && !subscriptionActive) {
    const planPricing = await getPlanPricing();
    const navState = { authenticated: true, dashboardHref: null } as const;
    return (
      <>
        <MarketingHeader navState={navState} />
        <MarketingHomeContent planPricing={planPricing} dashboardHref={null} />
        <MarketingFooter navState={navState} />
      </>
    );
  }

  return (
    <CreateClinicScreen
      t={t}
      pendingInvitations={pendingInvitations}
      unverifiedEmail={!user.email_confirmed_at ? user.email : null}
    />
  );
}
