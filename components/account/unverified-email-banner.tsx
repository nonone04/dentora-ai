import Link from "next/link";
import { MailWarningIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";

export async function UnverifiedEmailBanner({ email }: { email: string }) {
  const t = await getServerDictionary();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-primary/10 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <MailWarningIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t.verifyEmail.banner.message}</span>
      </div>
      <Button size="sm" nativeButton={false} render={<Link href={`/verify-email?email=${encodeURIComponent(email)}`} />}>
        {t.verifyEmail.banner.cta}
      </Button>
    </div>
  );
}
