import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";

export default async function AuthConfirmErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; reason?: string }>;
}) {
  const { type, reason } = await searchParams;
  const t = await getServerDictionary();

  const isRecovery = type === "recovery";
  const isExpired = reason === "expired";

  const title = isExpired
    ? isRecovery
      ? t.authConfirmError.expiredTitleRecovery
      : t.authConfirmError.expiredTitleSignup
    : t.authConfirmError.invalidTitle;

  return (
    <AuthShell t={t}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-xs text-sm text-balance text-muted-foreground">{t.authConfirmError.invalidDescription}</p>
      </div>

      <div className="mt-7 flex flex-col gap-3">
        {isRecovery ? (
          <AuthButton nativeButton={false} render={<Link href="/forgot-password" />}>
            {t.authConfirmError.requestNewReset}
          </AuthButton>
        ) : (
          <AuthButton nativeButton={false} render={<Link href="/login" />}>
            {t.authConfirmError.resendVerification}
          </AuthButton>
        )}
        <Button
          variant="outline"
          className="h-11 w-full rounded-xl border-white/10 bg-white/5 text-[15px] font-semibold text-white hover:bg-white/10"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          {t.authConfirmError.backToLogin}
        </Button>
      </div>
    </AuthShell>
  );
}
