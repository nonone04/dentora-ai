import { redirect } from "next/navigation";
import { CreateClinicScreen } from "@/components/onboarding/create-clinic-screen";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingHomeContent } from "@/components/marketing/home-content";
import { getServerDictionary } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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
    return (
      <>
        <MarketingHeader />
        <MarketingHomeContent />
        <MarketingFooter />
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

  const { data: pendingData } = await supabase.rpc("get_pending_invitations");
  const pendingInvitations = (pendingData ?? []) as PendingInvitation[];

  return (
    <CreateClinicScreen
      t={t}
      pendingInvitations={pendingInvitations}
      unverifiedEmail={!user.email_confirmed_at ? user.email : null}
    />
  );
}
