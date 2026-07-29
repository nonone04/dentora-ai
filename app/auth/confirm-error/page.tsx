import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
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
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title={title}
            description={t.authConfirmError.invalidDescription}
            action={
              <div className="flex flex-col gap-2">
                {isRecovery ? (
                  <Button size="sm" nativeButton={false} render={<Link href="/forgot-password" />}>
                    {t.authConfirmError.requestNewReset}
                  </Button>
                ) : (
                  <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
                    {t.authConfirmError.resendVerification}
                  </Button>
                )}
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/login" />}>
                  {t.authConfirmError.backToLogin}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
