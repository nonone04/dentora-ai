import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { ResendVerificationButton } from "@/components/account/resend-verification-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerDictionary, interpolate } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/auth";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirectTo?: string }>;
}) {
  const { email: emailParam } = await searchParams;
  const t = await getServerDictionary();
  const user = await getUser();

  // Reachable either with a session (email confirmation disabled at the
  // project level, so a session exists pre-verification) or without one
  // (confirmation blocks sign-in entirely, and signIn redirected here with
  // ?email= after a correct-password attempt against an unconfirmed account).
  const email = user?.email ?? emailParam;

  if (!email) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.verifyEmail.title}</CardTitle>
          <CardDescription>{interpolate(t.verifyEmail.description, { email })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ResendVerificationButton email={email} />
          {user && (
            <form action={signOut}>
              <Button type="submit" variant="ghost" className="w-full">
                {t.header.signOut}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
