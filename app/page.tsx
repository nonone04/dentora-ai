import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { CreateClinicForm } from "@/components/onboarding/create-clinic-form";
import { AcceptInvitationButton } from "@/components/team/accept-invitation-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect(`/clinic/${membership.clinic_id}`);
  }

  const { data: pendingData } = await supabase.rpc("get_pending_invitations");
  const pendingInvitations = (pendingData ?? []) as PendingInvitation[];

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        {pendingInvitations.map((invitation) => (
          <Card key={invitation.membership_id}>
            <CardHeader>
              <CardTitle>You&apos;ve been invited</CardTitle>
              <CardDescription>
                Join <span className="font-medium text-foreground">{invitation.clinic_name}</span>{" "}
                as
              </CardDescription>
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
            <CardTitle>Create your clinic</CardTitle>
            <CardDescription>
              {pendingInvitations.length > 0
                ? "Or set up your own clinic instead."
                : "Your account isn't linked to a clinic yet. Set one up to get started, or ask a clinic owner or admin to add you as a member instead."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CreateClinicForm />
            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
