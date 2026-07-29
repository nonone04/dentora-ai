import { redirect } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ResendVerificationButton } from "@/components/account/resend-verification-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
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
    <AuthShell t={t}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-white shadow-lg shadow-blue-600/20">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{t.verifyEmail.title}</h2>
        <p className="text-sm text-muted-foreground">{interpolate(t.verifyEmail.description, { email })}</p>
      </div>

      <div className="mt-7 flex flex-col gap-3">
        <ResendVerificationButton email={email} />
        {user ? (
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="h-10 w-full">
              {t.header.signOut}
            </Button>
          </form>
        ) : (
          <Button variant="ghost" className="h-10 w-full" nativeButton={false} render={<Link href="/login" />}>
            {t.forgotPassword.backToLogin}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
