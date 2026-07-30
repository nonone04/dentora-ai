import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";

export default async function BillingSuccessPage() {
  await requireUser();
  const t = await getServerDictionary();

  return (
    <AuthShell t={t}>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-white shadow-lg shadow-blue-600/20">
          <BadgeCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{t.billing.success.title}</h2>
        <p className="text-sm text-muted-foreground">{t.billing.success.description}</p>
      </div>

      <div className="mt-7">
        <Button className="h-10 w-full" nativeButton={false} render={<Link href="/" />}>
          {t.billing.success.cta}
        </Button>
      </div>
    </AuthShell>
  );
}
