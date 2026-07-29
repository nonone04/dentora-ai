import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { UnverifiedEmailBanner } from "@/components/account/unverified-email-banner";
import { CreateClinicForm } from "@/components/onboarding/create-clinic-form";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingHomeContent } from "@/components/marketing/home-content";
import { AcceptInvitationButton } from "@/components/team/accept-invitation-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerDictionary, interpolate } from "@/lib/i18n/server";
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
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        {!user.email_confirmed_at && user.email && <UnverifiedEmailBanner email={user.email} />}
        {pendingInvitations.map((invitation) => (
          <Card key={invitation.membership_id}>
            <CardHeader>
              <CardTitle>{t.onboarding.invitedTitle}</CardTitle>
              <CardDescription>{interpolate(t.onboarding.invitedJoinAs, { clinicName: invitation.clinic_name })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit capitalize">
                {invitation.role}
              </Badge>
              <AcceptInvitationButton membershipId={invitation.membership_id} />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>{t.onboarding.createClinicTitle}</CardTitle>
            <CardDescription>
              {pendingInvitations.length > 0
                ? t.onboarding.createClinicDescriptionWithInvitations
                : t.onboarding.createClinicDescriptionNoInvitations}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CreateClinicForm />
            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                {t.header.signOut}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
